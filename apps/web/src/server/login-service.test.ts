import { createHash, createHmac } from "node:crypto";
import { SELF_ITEMS } from "@grani/content";
import { createTestDb, getResultForOwner, getUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { signPending, verifySession } from "./auth/tokens";
import type { AppEnv } from "./env";
import {
  completeLogin,
  finishVkLogin,
  getCurrentUser,
  giveConsent,
  loginWithTelegram,
  startVkLogin,
  type LoginCookies,
  type LoginDeps,
} from "./login-service";
import { parseAnswers } from "./results-service";

const NOW = new Date("2026-09-17T12:00:00Z");
const ENV: AppEnv = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://unused",
  SESSION_SECRET: "s".repeat(40),
  TELEGRAM_BOT_TOKEN: "123456:TEST-TOKEN",
  TELEGRAM_BOT_USERNAME: "test_grani_bot",
  VK_CLIENT_ID: "555",
};
const NO_COOKIES: LoginCookies = { session: null, pending: null, consent: null };
const ANNA = { provider: "telegram", externalId: "42", displayName: "Аня", gender: null } as const;

let db: Database;
let deps: LoginDeps;

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function signedWidgetParams(fields: Record<string, string>): URLSearchParams {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHash("sha256").update(ENV.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dataCheckString).digest("hex") });
}

async function pendingToken(): Promise<string> {
  return signPending(parseAnswers(Object.fromEntries(SELF_ITEMS.map((item) => [item.id, 5])))!, ENV.SESSION_SECRET);
}

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, env: ENV, now: () => NOW, fetchFn: vi.fn() };
});

describe("completeLogin", () => {
  test("does not create a user without consent and keeps the answers", async () => {
    const outcome = await completeLogin(deps, ANNA, { ...NO_COOKIES, pending: await pendingToken() });

    expect(outcome).toEqual({ ok: false, error: "consent_required" });
  });

  test("creates a user with consent and sends them to the test when there are no answers", async () => {
    const outcome = await completeLogin(deps, ANNA, { ...NO_COOKIES, consent: await giveConsent(deps) });

    expect(outcome.ok && outcome.redirectTo).toBe("/test");
    const userId = outcome.ok ? await verifySession(outcome.sessionToken, ENV.SESSION_SECRET) : null;
    expect(userId && (await getUser(db, userId))?.displayName).toBe("Аня");
  });

  test("saves pending answers and opens the new result", async () => {
    const outcome = await completeLogin(deps, ANNA, { ...NO_COOKIES, consent: await giveConsent(deps), pending: await pendingToken() });

    expect(outcome.ok && outcome.redirectTo).toMatch(/^\/result\/[0-9a-f-]{36}$/);
    const userId = outcome.ok ? await verifySession(outcome.sessionToken, ENV.SESSION_SECRET) : null;
    const resultId = outcome.ok ? outcome.redirectTo.split("/").at(-1)! : "";
    expect(userId && (await getResultForOwner(db, resultId, userId))?.typeCode).toBe("++++");
  });

  test("lets a returning user in without a new consent and opens the latest result", async () => {
    const first = await completeLogin(deps, ANNA, { ...NO_COOKIES, consent: await giveConsent(deps), pending: await pendingToken() });

    const second = await completeLogin(deps, ANNA, NO_COOKIES);

    expect(second.ok && second.redirectTo).toBe(first.ok && first.redirectTo);
  });
});

describe("loginWithTelegram", () => {
  test("logs in with valid widget params", async () => {
    const params = signedWidgetParams({ id: "42", first_name: "Аня", last_name: "Петрова", auth_date: String(NOW.getTime() / 1000) });

    const outcome = await loginWithTelegram(deps, params, { ...NO_COOKIES, consent: await giveConsent(deps) });

    const userId = outcome.ok ? await verifySession(outcome.sessionToken, ENV.SESSION_SECRET) : null;
    expect(userId && (await getUser(db, userId))?.displayName).toBe("Аня Петрова");
  });

  test("reports a bad signature", async () => {
    const params = new URLSearchParams({ id: "42", first_name: "Аня", auth_date: "1", hash: "00" });

    expect(await loginWithTelegram(deps, params, NO_COOKIES)).toEqual({ ok: false, error: "telegram_BAD_HASH" });
  });
});

describe("VK ID login", () => {
  test("round-trips state and creates a user with gender from VK", async () => {
    const { redirectUrl, stateCookie } = await startVkLogin(deps);
    const state = new URL(redirectUrl).searchParams.get("state");
    deps.fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at" }))
      .mockResolvedValueOnce(jsonResponse({ user: { user_id: 777, first_name: "Аня", sex: 1 } }));

    const outcome = await finishVkLogin(deps, {
      code: "code",
      deviceId: "device",
      state,
      stateCookie,
      cookies: { ...NO_COOKIES, consent: await giveConsent(deps) },
    });

    const userId = outcome.ok ? await verifySession(outcome.sessionToken, ENV.SESSION_SECRET) : null;
    expect(userId && (await getUser(db, userId))?.gender).toBe("female");
  });

  test("rejects a state that does not match the signed cookie", async () => {
    const { stateCookie } = await startVkLogin(deps);

    const outcome = await finishVkLogin(deps, { code: "c", deviceId: "d", state: "forged", stateCookie, cookies: NO_COOKIES });

    expect(outcome).toEqual({ ok: false, error: "vk_state_mismatch" });
  });

  test("reports missing callback parameters", async () => {
    expect(
      await finishVkLogin(deps, { code: null, deviceId: "d", state: "s", stateCookie: "x", cookies: NO_COOKIES }),
    ).toEqual({ ok: false, error: "vk_missing_params" });
  });
});

describe("getCurrentUser", () => {
  test("returns the signed-in user and null for anonymous or forged sessions", async () => {
    const outcome = await completeLogin(deps, ANNA, { ...NO_COOKIES, consent: await giveConsent(deps) });
    const token = outcome.ok ? outcome.sessionToken : null;

    expect((await getCurrentUser(deps, token))?.displayName).toBe("Аня");
    expect(await getCurrentUser(deps, null)).toBeNull();
    expect(await getCurrentUser(deps, "forged")).toBeNull();
  });
});
