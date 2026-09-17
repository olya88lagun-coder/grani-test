# Task 4: Подписи Telegram, VK ID и подписанные токены

**Files:**
- Create: `apps/web/src/server/auth/telegram.ts`, `apps/web/src/server/auth/vk.ts`, `apps/web/src/server/auth/tokens.ts`
- Test: `apps/web/src/server/auth/telegram.test.ts`, `apps/web/src/server/auth/vk.test.ts`, `apps/web/src/server/auth/tokens.test.ts`

**Interfaces:**
- Consumes: `Answers` из `@grani/core`; `Consent`, `KnownGender` из `@grani/db` (Task 2).
- Produces:
  ```ts
  // telegram.ts
  const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;
  type TelegramUser = { id: number; firstName: string; lastName: string | null; username: string | null };
  type TelegramVerifyResult = { ok: true; user: TelegramUser } | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };
  function verifyTelegramLoginWidget(params: URLSearchParams, botToken: string, now: Date, maxAgeSeconds?: number): TelegramVerifyResult;

  // vk.ts
  const VK_ID_HOST = "https://id.vk.ru";
  type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
  type VkUser = { id: string; firstName: string; lastName: string | null; gender: KnownGender | null };
  function createPkcePair(): { codeVerifier: string; codeChallenge: string };
  function buildVkAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  function exchangeVkCode(p: { clientId: string; redirectUri: string; code: string; codeVerifier: string; deviceId: string; state: string; fetchFn: FetchFn }): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>;
  function fetchVkUser(p: { clientId: string; accessToken: string; fetchFn: FetchFn }): Promise<{ ok: true; user: VkUser } | { ok: false; error: string }>;

  // tokens.ts
  type VkState = { state: string; codeVerifier: string };
  function signSession(userId: string, secret: string): Promise<string>;
  function verifySession(token: string, secret: string): Promise<string | null>;
  function signVkState(payload: VkState, secret: string): Promise<string>;
  function verifyVkState(token: string, secret: string): Promise<VkState | null>;
  function signPending(answers: Answers, secret: string): Promise<string>;
  function verifyPending(token: string, secret: string): Promise<Record<string, number> | null>; // проверка значений — в Task 5
  function signConsent(consent: Consent, secret: string): Promise<string>;
  function verifyConsent(token: string, secret: string): Promise<Consent | null>;
  ```

Код входа переносится из `C:\dev\wishlist\packages\core\src\auth\` с тремя отличиями: нет Mini App (`verifyTelegramInitData` не нужен), у Telegram-пользователя нет фото, у VK-пользователя вместо аватара — пол (`sex` в ответе `user_info`: `1` — женский, `2` — мужской, иначе неизвестен). Все токены — JWT HS256 с разными `aud`, поэтому токен одного назначения не принимается как другой.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/server/auth/telegram.test.ts`:
```ts
import { createHash, createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyTelegramLoginWidget } from "./telegram";

const BOT_TOKEN = "123456:TEST-TOKEN";
const NOW = new Date("2026-09-17T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function signWidget(fields: Record<string, string>, token = BOT_TOKEN): URLSearchParams {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

describe("verifyTelegramLoginWidget", () => {
  test("accepts correctly signed fresh widget params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", last_name: "Петрова", username: "anya", auth_date: String(nowSec) });

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Аня", lastName: "Петрова", username: "anya" },
    });
  });

  test("rejects tampered params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec) });
    params.set("id", "43");

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects params signed for another bot", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec) }, "999:OTHER");

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale params", () => {
    const params = signWidget({ id: "42", first_name: "Аня", auth_date: String(nowSec - 86401) });

    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  test("rejects a missing hash and a missing first name", () => {
    expect(verifyTelegramLoginWidget(new URLSearchParams({ id: "42" }), BOT_TOKEN, NOW)).toEqual({
      ok: false,
      reason: "MISSING_HASH",
    });
    const noName = signWidget({ id: "42", auth_date: String(nowSec) });
    expect(verifyTelegramLoginWidget(noName, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});
```

`apps/web/src/server/auth/vk.test.ts`:
```ts
import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { buildVkAuthorizeUrl, createPkcePair, exchangeVkCode, fetchVkUser } from "./vk";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createPkcePair", () => {
  test("derives the challenge as base64url(sha256(verifier))", () => {
    const { codeVerifier, codeChallenge } = createPkcePair();

    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(codeChallenge).toBe(createHash("sha256").update(codeVerifier).digest("base64url"));
  });

  test("generates a different verifier each time", () => {
    expect(createPkcePair().codeVerifier).not.toBe(createPkcePair().codeVerifier);
  });
});

describe("buildVkAuthorizeUrl", () => {
  test("contains all OAuth 2.1 PKCE parameters", () => {
    const url = new URL(
      buildVkAuthorizeUrl({ clientId: "123", redirectUri: "https://grani-test.ru/api/auth/vk/callback", state: "st", codeChallenge: "ch" }),
    );

    expect(url.origin + url.pathname).toBe("https://id.vk.ru/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "123",
      redirect_uri: "https://grani-test.ru/api/auth/vk/callback",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
      scope: "vkid.personal_info",
    });
  });
});

describe("exchangeVkCode", () => {
  test("posts the form to the token endpoint and returns the access token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at-1" }));

    const result = await exchangeVkCode({
      clientId: "123",
      redirectUri: "https://grani-test.ru/cb",
      code: "c1",
      codeVerifier: "v1",
      deviceId: "d1",
      state: "st",
      fetchFn,
    });

    expect(result).toEqual({ ok: true, accessToken: "at-1" });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://id.vk.ru/oauth2/auth");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      grant_type: "authorization_code",
      code: "c1",
      code_verifier: "v1",
      client_id: "123",
      device_id: "d1",
      redirect_uri: "https://grani-test.ru/cb",
      state: "st",
    });
  });

  test("returns the provider error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, 400));

    const result = await exchangeVkCode({ clientId: "1", redirectUri: "r", code: "c", codeVerifier: "v", deviceId: "d", state: "s", fetchFn });

    expect(result).toEqual({ ok: false, error: "invalid_grant" });
  });

  test("reports a network failure as an error instead of throwing", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    const result = await exchangeVkCode({ clientId: "1", redirectUri: "r", code: "c", codeVerifier: "v", deviceId: "d", state: "s", fetchFn });

    expect(result).toEqual({ ok: false, error: "network" });
  });
});

describe("fetchVkUser", () => {
  test.each([
    [1, "female"],
    [2, "male"],
    [0, null],
    [undefined, null],
  ] as const)("maps sex %s to gender %s", async (sex, gender) => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: { user_id: 777, first_name: "Аня", last_name: "", sex } }));

    expect(await fetchVkUser({ clientId: "123", accessToken: "at-1", fetchFn })).toEqual({
      ok: true,
      user: { id: "777", firstName: "Аня", lastName: null, gender },
    });
  });

  test("fails on a malformed response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: {} }));

    expect(await fetchVkUser({ clientId: "1", accessToken: "a", fetchFn })).toEqual({ ok: false, error: "malformed_user_info" });
  });
});
```

`apps/web/src/server/auth/tokens.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  signConsent,
  signPending,
  signSession,
  signVkState,
  verifyConsent,
  verifyPending,
  verifySession,
  verifyVkState,
} from "./tokens";

const SECRET = "a".repeat(64);

describe("session tokens", () => {
  test("round-trip a user id", async () => {
    expect(await verifySession(await signSession("user-1", SECRET), SECRET)).toBe("user-1");
  });

  test("reject another secret and garbage", async () => {
    expect(await verifySession(await signSession("user-1", "b".repeat(64)), SECRET)).toBeNull();
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
  });
});

describe("vk state tokens", () => {
  test("round-trip the state and verifier", async () => {
    const payload = { state: "st-1", codeVerifier: "ver-1" };

    expect(await verifyVkState(await signVkState(payload, SECRET), SECRET)).toEqual(payload);
  });
});

describe("pending answers tokens", () => {
  test("round-trip the answers", async () => {
    const answers = { "ipip-01": 5, "ipip-02": 1 } as const;

    expect(await verifyPending(await signPending(answers, SECRET), SECRET)).toEqual(answers);
  });
});

describe("consent tokens", () => {
  test("round-trip the version and time with second precision", async () => {
    const consent = { version: "2026-09-v1", at: new Date("2026-09-17T10:00:00.750Z") };

    expect(await verifyConsent(await signConsent(consent, SECRET), SECRET)).toEqual({
      version: "2026-09-v1",
      at: new Date("2026-09-17T10:00:00.000Z"),
    });
  });
});

describe("audiences", () => {
  test("a token of one kind is never accepted as another", async () => {
    const session = await signSession("user-1", SECRET);
    const consent = await signConsent({ version: "v", at: new Date() }, SECRET);
    const pending = await signPending({ "ipip-01": 3 }, SECRET);

    expect(await verifyConsent(session, SECRET)).toBeNull();
    expect(await verifyPending(consent, SECRET)).toBeNull();
    expect(await verifySession(pending, SECRET)).toBeNull();
    expect(await verifyVkState(session, SECRET)).toBeNull();
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/auth
```
Expected: FAIL — не найдены `./telegram`, `./vk`, `./tokens`.

- [ ] **Step 2: Реализация `telegram.ts`**

`apps/web/src/server/auth/telegram.ts`:
```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;

export type TelegramUser = { id: number; firstName: string; lastName: string | null; username: string | null };

export type TelegramVerifyResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };

const optional = (value: string | undefined) => (value !== undefined && value.length > 0 ? value : null);

export function verifyTelegramLoginWidget(
  params: URLSearchParams,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "MISSING_HASH" };
  const fields = new Map<string, string>();
  for (const [key, value] of params) if (key !== "hash") fields.set(key, value);
  const dataCheckString = [...fields.keys()]
    .sort()
    .map((key) => `${key}=${fields.get(key)}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "BAD_HASH" };

  const authDate = Number(fields.get("auth_date"));
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > maxAgeSeconds) return { ok: false, reason: "EXPIRED" };

  const id = Number(fields.get("id"));
  const firstName = fields.get("first_name");
  if (!Number.isSafeInteger(id) || !firstName) return { ok: false, reason: "MALFORMED" };
  return {
    ok: true,
    user: { id, firstName, lastName: optional(fields.get("last_name")), username: optional(fields.get("username")) },
  };
}
```

- [ ] **Step 3: Реализация `vk.ts`**

`apps/web/src/server/auth/vk.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";
import type { KnownGender } from "@grani/db";

export const VK_ID_HOST = "https://id.vk.ru";
const VK_SCOPE = "vkid.personal_info";
const FORM_HEADERS = { "content-type": "application/x-www-form-urlencoded" };
const PKCE_VERIFIER_BYTES = 48;
const VK_SEX_FEMALE = 1;
const VK_SEX_MALE = 2;

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
export type VkUser = { id: string; firstName: string; lastName: string | null; gender: KnownGender | null };

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(PKCE_VERIFIER_BYTES).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildVkAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const url = new URL("/authorize", VK_ID_HOST);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    scope: VK_SCOPE,
  }).toString();
  return url.toString();
}

async function postForm(fetchFn: FetchFn, path: string, form: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchFn(`${VK_ID_HOST}${path}`, {
      method: "POST",
      headers: FORM_HEADERS,
      body: new URLSearchParams(form).toString(),
    });
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function exchangeVkCode(p: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  deviceId: string;
  state: string;
  fetchFn: FetchFn;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/auth", {
    grant_type: "authorization_code",
    code: p.code,
    code_verifier: p.codeVerifier,
    client_id: p.clientId,
    device_id: p.deviceId,
    redirect_uri: p.redirectUri,
    state: p.state,
  });
  if (body === null) return { ok: false, error: "network" };
  if (typeof body.access_token === "string") return { ok: true, accessToken: body.access_token };
  return { ok: false, error: typeof body.error === "string" ? body.error : "token_exchange_failed" };
}

function genderFromSex(sex: unknown): KnownGender | null {
  if (sex === VK_SEX_FEMALE) return "female";
  if (sex === VK_SEX_MALE) return "male";
  return null;
}

export async function fetchVkUser(p: {
  clientId: string;
  accessToken: string;
  fetchFn: FetchFn;
}): Promise<{ ok: true; user: VkUser } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/user_info", { access_token: p.accessToken, client_id: p.clientId });
  if (body === null) return { ok: false, error: "network" };
  const user = body.user as Record<string, unknown> | undefined;
  const id = user?.user_id;
  if (!user || (typeof id !== "string" && typeof id !== "number") || typeof user.first_name !== "string") {
    return { ok: false, error: "malformed_user_info" };
  }
  const lastName = typeof user.last_name === "string" && user.last_name.length > 0 ? user.last_name : null;
  return { ok: true, user: { id: String(id), firstName: user.first_name, lastName, gender: genderFromSex(user.sex) } };
}
```

- [ ] **Step 4: Реализация `tokens.ts`**

`apps/web/src/server/auth/tokens.ts`:
```ts
import type { Answers } from "@grani/core";
import type { Consent } from "@grani/db";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

const SESSION_TTL = "30d";
const VK_STATE_TTL = "10m";
const PENDING_TTL = "1d";
const CONSENT_TTL = "1h";

const AUDIENCE = { session: "session", vkState: "vk-state", pending: "pending-answers", consent: "consent" } as const;

const key = (secret: string) => new TextEncoder().encode(secret);

async function sign(payload: JWTPayload, audience: string, ttl: string, secret: string, subject?: string): Promise<string> {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience(audience).setIssuedAt().setExpirationTime(ttl);
  return (subject ? jwt.setSubject(subject) : jwt).sign(key(secret));
}

async function verify(token: string, audience: string, secret: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience, algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function signSession(userId: string, secret: string): Promise<string> {
  return sign({}, AUDIENCE.session, SESSION_TTL, secret, userId);
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  const payload = await verify(token, AUDIENCE.session, secret);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

export type VkState = { state: string; codeVerifier: string };

export async function signVkState(state: VkState, secret: string): Promise<string> {
  return sign({ ...state }, AUDIENCE.vkState, VK_STATE_TTL, secret);
}

export async function verifyVkState(token: string, secret: string): Promise<VkState | null> {
  const payload = await verify(token, AUDIENCE.vkState, secret);
  if (typeof payload?.state !== "string" || typeof payload.codeVerifier !== "string") return null;
  return { state: payload.state, codeVerifier: payload.codeVerifier };
}

export async function signPending(answers: Answers, secret: string): Promise<string> {
  return sign({ answers }, AUDIENCE.pending, PENDING_TTL, secret);
}

export async function verifyPending(token: string, secret: string): Promise<Record<string, number> | null> {
  const payload = await verify(token, AUDIENCE.pending, secret);
  const answers = payload?.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return null;
  return answers as Record<string, number>;
}

export async function signConsent(consent: Consent, secret: string): Promise<string> {
  const iat = Math.floor(consent.at.getTime() / 1000);
  return new SignJWT({ version: consent.version })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE.consent)
    .setIssuedAt(iat)
    .setExpirationTime(CONSENT_TTL)
    .sign(key(secret));
}

export async function verifyConsent(token: string, secret: string): Promise<Consent | null> {
  const payload = await verify(token, AUDIENCE.consent, secret);
  if (typeof payload?.version !== "string" || typeof payload.iat !== "number") return null;
  return { version: payload.version, at: new Date(payload.iat * 1000) };
}
```

`setExpirationTime("1h")` в `jose` отсчитывается от текущего времени, а не от `iat`, поэтому согласие с `at` в прошлом (как в тесте) остаётся валидным час с момента подписи.

- [ ] **Step 5: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 6: Коммит**

```bash
git add apps/web/src/server/auth
git commit -m "feat(web): Telegram widget and VK ID verification, signed session and consent tokens"
```
