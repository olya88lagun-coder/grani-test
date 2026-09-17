# Task 6: Согласие и вход — Telegram, VK ID, dev-вход, выход

**Files:**
- Create: `apps/web/src/server/login-service.ts`, `apps/web/src/server/dev-login.ts`, `apps/web/src/server/deps.ts`, `apps/web/src/server/viewer.ts`
- Create: `apps/web/src/app/api/consent/route.ts`, `apps/web/src/app/api/auth/telegram/widget/route.ts`, `apps/web/src/app/api/auth/vk/start/route.ts`, `apps/web/src/app/api/auth/vk/callback/route.ts`, `apps/web/src/app/api/auth/logout/route.ts`, `apps/web/src/app/api/dev/login/route.ts`
- Test: `apps/web/src/server/login-service.test.ts`, `apps/web/src/server/dev-login.test.ts`

**Interfaces:**
- Consumes: `upsertUserFromIdentity`, `getUser`, `getLatestResultId`, `IdentityInput`, `UserRecord`, `Database` (Task 2); `verifyTelegramLoginWidget`, `createPkcePair`, `buildVkAuthorizeUrl`, `exchangeVkCode`, `fetchVkUser`, `FetchFn`, `signSession`, `verifySession`, `signVkState`, `verifyVkState`, `signConsent`, `verifyConsent` (Task 4); `savePendingResult` (Task 5); `AppEnv`, `getEnv`, `getDb`, cookie-помощники (Task 3).
- Produces:
  ```ts
  const CONSENT_VERSION = "2026-09-v1";
  type LoginDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
  type LoginCookies = { session: string | null; pending: string | null; consent: string | null };
  type LoginOutcome = { ok: true; sessionToken: string; redirectTo: string } | { ok: false; error: string };
  function giveConsent(deps: Pick<LoginDeps, "env" | "now">): Promise<string>; // токен для CONSENT_COOKIE
  function completeLogin(deps: LoginDeps, identity: IdentityInput, cookies: LoginCookies): Promise<LoginOutcome>;
  function loginWithTelegram(deps: LoginDeps, params: URLSearchParams, cookies: LoginCookies): Promise<LoginOutcome>;
  function startVkLogin(deps: LoginDeps): Promise<{ redirectUrl: string; stateCookie: string }>;
  function finishVkLogin(deps: LoginDeps, p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; cookies: LoginCookies }): Promise<LoginOutcome>;
  function getCurrentUser(deps: Pick<LoginDeps, "db" | "env">, sessionToken: string | null): Promise<UserRecord | null>;
  // dev-login.ts
  function isDevLoginEnabled(env: Record<string, string | undefined>): boolean;
  // deps.ts
  function loginDeps(): LoginDeps;
  // viewer.ts
  function currentUser(): Promise<UserRecord | null>;
  function requireUser(): Promise<UserRecord>; // без входа — redirect("/login")
  ```

После входа человек попадает: на только что сохранённый результат из `grani_pending`, иначе на свой последний результат, иначе на `/test`. После любого исхода входа cookie `grani_pending` и `grani_consent` очищаются только при успехе — при ошибке ответы не теряются. Ошибка входа ведёт на `/login?error=<код>`; коды показывает страница входа (Task 8).

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/server/dev-login.test.ts`:
```ts
import { expect, test } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

test("dev login works only with DEV_LOGIN=1 outside production", () => {
  expect(isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(true);
  expect(isDevLoginEnabled({ NODE_ENV: "production", DEV_LOGIN: "1" })).toBe(false);
  expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
});
```

`apps/web/src/server/login-service.test.ts`:
```ts
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
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/login-service.test.ts apps/web/src/server/dev-login.test.ts
```
Expected: FAIL — не найдены `./login-service` и `./dev-login`.

- [ ] **Step 2: Реализация сервиса**

`apps/web/src/server/dev-login.ts`:
```ts
export function isDevLoginEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.DEV_LOGIN === "1";
}
```

`apps/web/src/server/login-service.ts`:
```ts
import { randomBytes } from "node:crypto";
import { getLatestResultId, getUser, upsertUserFromIdentity, type Database, type IdentityInput, type UserRecord } from "@grani/db";
import { verifyTelegramLoginWidget } from "./auth/telegram";
import { signConsent, signSession, signVkState, verifyConsent, verifySession, verifyVkState } from "./auth/tokens";
import { buildVkAuthorizeUrl, createPkcePair, exchangeVkCode, fetchVkUser, type FetchFn } from "./auth/vk";
import type { AppEnv } from "./env";
import { savePendingResult } from "./results-service";

export const CONSENT_VERSION = "2026-09-v1";
const STATE_BYTES = 24;

export type LoginDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
export type LoginCookies = { session: string | null; pending: string | null; consent: string | null };
export type LoginOutcome = { ok: true; sessionToken: string; redirectTo: string } | { ok: false; error: string };

const vkRedirectUri = (env: AppEnv) => new URL("/api/auth/vk/callback", env.APP_URL).toString();
const fullName = (first: string, last: string | null) => [first, last].filter(Boolean).join(" ");

export async function giveConsent(deps: Pick<LoginDeps, "env" | "now">): Promise<string> {
  return signConsent({ version: CONSENT_VERSION, at: deps.now() }, deps.env.SESSION_SECRET);
}

export async function completeLogin(deps: LoginDeps, identity: IdentityInput, cookies: LoginCookies): Promise<LoginOutcome> {
  const consent = cookies.consent ? await verifyConsent(cookies.consent, deps.env.SESSION_SECRET) : null;
  const upserted = await upsertUserFromIdentity(deps.db, identity, consent);
  if (!upserted.ok) return { ok: false, error: "consent_required" };
  const userId = upserted.user.id;
  const secretDeps = { db: deps.db, secret: deps.env.SESSION_SECRET };
  const resultId = (await savePendingResult(secretDeps, userId, cookies.pending)) ?? (await getLatestResultId(deps.db, userId));
  return {
    ok: true,
    sessionToken: await signSession(userId, deps.env.SESSION_SECRET),
    redirectTo: resultId ? `/result/${resultId}` : "/test",
  };
}

export async function loginWithTelegram(deps: LoginDeps, params: URLSearchParams, cookies: LoginCookies): Promise<LoginOutcome> {
  const verified = verifyTelegramLoginWidget(params, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  const { user } = verified;
  return completeLogin(
    deps,
    { provider: "telegram", externalId: String(user.id), displayName: fullName(user.firstName, user.lastName), gender: null },
    cookies,
  );
}

export async function startVkLogin(deps: LoginDeps): Promise<{ redirectUrl: string; stateCookie: string }> {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(STATE_BYTES).toString("base64url");
  const stateCookie = await signVkState({ state, codeVerifier }, deps.env.SESSION_SECRET);
  const redirectUrl = buildVkAuthorizeUrl({ clientId: deps.env.VK_CLIENT_ID, redirectUri: vkRedirectUri(deps.env), state, codeChallenge });
  return { redirectUrl, stateCookie };
}

export async function finishVkLogin(
  deps: LoginDeps,
  p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; cookies: LoginCookies },
): Promise<LoginOutcome> {
  if (!p.code || !p.deviceId || !p.state || !p.stateCookie) return { ok: false, error: "vk_missing_params" };
  const saved = await verifyVkState(p.stateCookie, deps.env.SESSION_SECRET);
  if (!saved || saved.state !== p.state) return { ok: false, error: "vk_state_mismatch" };

  const token = await exchangeVkCode({
    clientId: deps.env.VK_CLIENT_ID,
    redirectUri: vkRedirectUri(deps.env),
    code: p.code,
    codeVerifier: saved.codeVerifier,
    deviceId: p.deviceId,
    state: p.state,
    fetchFn: deps.fetchFn,
  });
  if (!token.ok) return { ok: false, error: `vk_${token.error}` };

  const profile = await fetchVkUser({ clientId: deps.env.VK_CLIENT_ID, accessToken: token.accessToken, fetchFn: deps.fetchFn });
  if (!profile.ok) return { ok: false, error: `vk_${profile.error}` };

  const { user } = profile;
  return completeLogin(
    deps,
    { provider: "vk", externalId: user.id, displayName: fullName(user.firstName, user.lastName), gender: user.gender },
    p.cookies,
  );
}

export async function getCurrentUser(deps: Pick<LoginDeps, "db" | "env">, sessionToken: string | null): Promise<UserRecord | null> {
  if (!sessionToken) return null;
  const userId = await verifySession(sessionToken, deps.env.SESSION_SECRET);
  return userId ? getUser(deps.db, userId) : null;
}
```

`apps/web/src/server/deps.ts`:
```ts
import { getDb } from "./db";
import { getEnv } from "./env";
import type { LoginDeps } from "./login-service";

export function loginDeps(): LoginDeps {
  return { db: getDb(), env: getEnv(), now: () => new Date(), fetchFn: (input, init) => fetch(input, init) };
}
```

`apps/web/src/server/viewer.ts`:
```ts
import type { UserRecord } from "@grani/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getEnv } from "./env";
import { SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";

export async function currentUser(): Promise<UserRecord | null> {
  const store = await cookies();
  return getCurrentUser({ db: getDb(), env: getEnv() }, store.get(SESSION_COOKIE)?.value ?? null);
}

export async function requireUser(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
```

- [ ] **Step 3: Маршруты**

Общий помощник чтения cookie и выдачи ответа — в каждом маршруте входа одинаковый, поэтому вынести его в `apps/web/src/server/login-response.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import type { AppEnv } from "./env";
import {
  CONSENT_COOKIE,
  consentCookieOptions,
  expiredCookieOptions,
  PENDING_COOKIE,
  pendingCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./http";
import type { LoginCookies, LoginOutcome } from "./login-service";

export function readLoginCookies(request: NextRequest): LoginCookies {
  return {
    session: request.cookies.get(SESSION_COOKIE)?.value ?? null,
    pending: request.cookies.get(PENDING_COOKIE)?.value ?? null,
    consent: request.cookies.get(CONSENT_COOKIE)?.value ?? null,
  };
}

export function loginResponse(env: AppEnv, outcome: LoginOutcome): NextResponse {
  if (!outcome.ok) {
    console.warn("login failed", outcome.error);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(outcome.error)}`, env.APP_URL), 303);
  }
  const response = NextResponse.redirect(new URL(outcome.redirectTo, env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, outcome.sessionToken, sessionCookieOptions(env.APP_URL));
  response.cookies.set(PENDING_COOKIE, "", expiredCookieOptions(pendingCookieOptions(env.APP_URL)));
  response.cookies.set(CONSENT_COOKIE, "", expiredCookieOptions(consentCookieOptions(env.APP_URL)));
  return response;
}
```

`apps/web/src/app/api/consent/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { CONSENT_COOKIE, consentCookieOptions, isSameOrigin } from "@/server/http";
import { giveConsent } from "@/server/login-service";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONSENT_COOKIE, await giveConsent(deps), consentCookieOptions(deps.env.APP_URL));
  return response;
}
```

`apps/web/src/app/api/auth/telegram/widget/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { loginWithTelegram } from "@/server/login-service";

export async function GET(request: NextRequest) {
  const deps = loginDeps();
  const outcome = await loginWithTelegram(deps, request.nextUrl.searchParams, readLoginCookies(request));
  return loginResponse(deps.env, outcome);
}
```

`apps/web/src/app/api/auth/vk/start/route.ts`:
```ts
import { NextResponse } from "next/server";
import { loginDeps } from "@/server/deps";
import { VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";
import { startVkLogin } from "@/server/login-service";

export async function GET() {
  const deps = loginDeps();
  const { redirectUrl, stateCookie } = await startVkLogin(deps);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(VK_STATE_COOKIE, stateCookie, vkStateCookieOptions(deps.env.APP_URL));
  return response;
}
```

`apps/web/src/app/api/auth/vk/callback/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { finishVkLogin } from "@/server/login-service";

export async function GET(request: NextRequest) {
  const deps = loginDeps();
  const q = request.nextUrl.searchParams;
  const outcome = await finishVkLogin(deps, {
    code: q.get("code"),
    deviceId: q.get("device_id"),
    state: q.get("state"),
    stateCookie: request.cookies.get(VK_STATE_COOKIE)?.value ?? null,
    cookies: readLoginCookies(request),
  });
  const response = loginResponse(deps.env, outcome);
  response.cookies.set(VK_STATE_COOKIE, "", expiredCookieOptions(vkStateCookieOptions(deps.env.APP_URL)));
  return response;
}
```

`apps/web/src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { expiredCookieOptions, isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const response = NextResponse.redirect(new URL("/", env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions(sessionCookieOptions(env.APP_URL)));
  return response;
}
```

`apps/web/src/app/api/dev/login/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isDevLoginEnabled } from "@/server/dev-login";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { completeLogin, giveConsent } from "@/server/login-service";

// Только для локальной разработки и E2E: Telegram-виджет не работает на localhost.
// Dev-вход считает согласие данным, иначе сквозной сценарий пришлось бы проходить через настоящий виджет.
export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled(process.env)) return new NextResponse(null, { status: 404 });
  const deps = loginDeps();
  const name = request.nextUrl.searchParams.get("name") ?? "Разработчик";
  const cookies = { ...readLoginCookies(request), consent: await giveConsent(deps) };
  const outcome = await completeLogin(deps, { provider: "telegram", externalId: `dev-${name}`, displayName: name, gender: null }, cookies);
  return loginResponse(deps.env, outcome);
}
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/server apps/web/src/app/api
git commit -m "feat(web): consent, Telegram and VK ID login with pending answers, dev login and logout"
```
