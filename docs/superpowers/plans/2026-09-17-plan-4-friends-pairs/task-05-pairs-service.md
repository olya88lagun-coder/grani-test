# Task 5: Сервис пар — приглашение, возврат после теста и входа, согласие, выход

**Files:**
- Create: `apps/web/src/server/pairs-service.ts`
- Create: `apps/web/src/app/api/pairs/invites/route.ts`, `apps/web/src/app/api/pairs/join/route.ts`, `apps/web/src/app/api/pairs/accept/route.ts`, `apps/web/src/app/api/pairs/[id]/leave/route.ts`
- Modify: `apps/web/src/server/http.ts`, `apps/web/src/server/login-service.ts`, `apps/web/src/server/login-response.ts`, `apps/web/src/app/api/results/route.ts`
- Test: `apps/web/src/server/pairs-service.test.ts`, `apps/web/src/server/http.test.ts` (дополнение), `apps/web/src/server/login-service.test.ts` (дополнение)

**Interfaces:**
- Consumes: `getOrCreatePairInvite`, `getPairInviteByToken`, `acceptPairInvite`, `leavePair`, `isInviteToken`, `getLatestResultId`, `getResultForOwner`, `UserRecord`, `seedUserWithResult` (Task 1, план 3); `NotifyJob` (Task 3); `firstName` (Task 3); `enqueueNotify` (Task 3); `invitesLimiter` (Task 3).
- Produces:
  ```ts
  // http.ts
  const PAIR_COOKIE = "grani_pair";
  function pairCookieOptions(appUrl: string): CookieOptions; // 1 день

  // pairs-service.ts
  type PairsDeps = { db: Database; now: () => Date; enqueueNotify: (job: NotifyJob) => Promise<void> };
  type PairInvitePage =
    | { state: "not_found" }
    | { state: "used"; inviterFirstName: string }
    | { state: "own"; token: string }
    | { state: "needs_login"; inviterFirstName: string; token: string }
    | { state: "needs_result"; inviterFirstName: string; token: string }
    | { state: "ready"; inviterFirstName: string; inviterGender: Gender; token: string };
  type AcceptPairOutcome =
    | { ok: true; pairId: string }
    | { ok: false; error: "consent_required" | "no_result" | "not_found" | "own_invite" | "already_used" | "already_paired" };
  function createPairInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null>;
  function getPairInvitePage(db: Database, token: string, viewer: UserRecord | null): Promise<PairInvitePage>;
  function acceptPair(deps: PairsDeps, p: { token: string; userId: string; consent: boolean }): Promise<AcceptPairOutcome>;
  function pairReturnPath(pairCookie: string | null | undefined): string | null; // "/p/<token>" или null

  // login-service.ts
  type LoginCookies = { session: string | null; pending: string | null; consent: string | null; pairInvite?: string | null };
  ```

Маршруты:
- `POST /api/pairs/invites` — тело `{ resultId }`, нужен вход; ответ `{ ok: true, url }` (`APP_URL/p/<token>`) или `{ ok: false, error }` как у `POST /api/invites`.
- `GET /api/pairs/join?token=<token>&next=test|login` — ставит cookie `grani_pair` с токеном и переводит на `/test` или `/login` (303). Неверный токен — переход на `/p/<token>`, где страница покажет «не найдено».
- `POST /api/pairs/accept` — тело `{ token, consent }`, нужен вход; ответ `{ ok: true, redirect: "/pair/<id>" }` и удаление cookie `grani_pair`, или `{ ok: false, error }` со статусами 400 (`consent_required`, `no_result`), 401 (`unauthorized`), 404 (`not_found`), 409 (`own_invite`, `already_used`, `already_paired`), 403 (`bad_origin`).
- `POST /api/pairs/<id>/leave` — обычная форма; переход на `/me` (303) и в случае успеха, и если пары уже нет.

**Возврат партнёра.** Партнёр приходит по ссылке `/p/<token>` без входа и без результата. Кнопки страницы ведут через `/api/pairs/join`, который запоминает токен в `grani_pair`. Дальше обычный путь плана 3: тест → вход (или сразу вход). После входа (`completeLogin`) и после сохранения результата вошедшим (`POST /api/results`) человек возвращается на `/p/<token>` вместо страницы результата — отложенные ответы при этом сохраняются как обычно. Cookie удаляется, когда пара создана.

**Согласие партнёра** (спецификация 4.6, шаг 3): без `consent: true` пара не создаётся. Время согласия — `now()` сервера, записывается в `pairs.partner_consent_at`. Партнёру берётся его **последний** результат.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/server/pairs-service.test.ts`:
```ts
import { createTestDb, getPairForMember, getUser, seedUserWithResult, upsertUserFromIdentity, type Database, type UserRecord } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { acceptPair, createPairInviteForOwner, getPairInvitePage, pairReturnPath, type PairsDeps } from "./pairs-service";

const NOW = new Date("2026-09-17T12:00:00Z");

let db: Database;
let deps: PairsDeps;
let anna: { userId: string; resultId: string };
let boris: { userId: string; resultId: string };
let token: string;

const user = async (id: string) => (await getUser(db, id)) as UserRecord;

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, now: () => NOW, enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  anna = await seedUserWithResult(db, { externalId: "anna", displayName: "Аня Петрова", gender: "female" });
  boris = await seedUserWithResult(db, { externalId: "boris", displayName: "Борис" });
  token = (await createPairInviteForOwner(db, anna))!;
});

describe("createPairInviteForOwner", () => {
  test("only the owner of the result can invite", async () => {
    expect(await createPairInviteForOwner(db, anna)).toBe(token);
    expect(await createPairInviteForOwner(db, { userId: boris.userId, resultId: anna.resultId })).toBeNull();
  });
});

describe("getPairInvitePage", () => {
  test("guides an anonymous visitor to log in", async () => {
    expect(await getPairInvitePage(db, token, null)).toEqual({ state: "needs_login", inviterFirstName: "Аня", token });
  });

  test("asks a signed-in partner without a result to take the test", async () => {
    const created = await upsertUserFromIdentity(db, { provider: "vk", externalId: "new", displayName: "Вера", gender: null }, { version: "v", at: NOW });
    const vera = created.ok ? created.user : null;

    expect((await getPairInvitePage(db, token, vera))?.state).toBe("needs_result");
  });

  test("shows the consent step to a partner with a result", async () => {
    expect(await getPairInvitePage(db, token, await user(boris.userId))).toEqual({ state: "ready", inviterFirstName: "Аня", inviterGender: "female", token });
  });

  test("tells the inviter it is their own link", async () => {
    expect(await getPairInvitePage(db, token, await user(anna.userId))).toEqual({ state: "own", token });
  });

  test("reports used and unknown links", async () => {
    await acceptPair(deps, { token, userId: boris.userId, consent: true });

    expect(await getPairInvitePage(db, token, null)).toEqual({ state: "used", inviterFirstName: "Аня" });
    expect(await getPairInvitePage(db, "w".repeat(24), null)).toEqual({ state: "not_found" });
  });
});

describe("acceptPair", () => {
  test("does not create a pair without consent", async () => {
    expect(await acceptPair(deps, { token, userId: boris.userId, consent: false })).toEqual({ ok: false, error: "consent_required" });
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("creates a pair with the partner's latest result and notifies both", async () => {
    const outcome = await acceptPair(deps, { token, userId: boris.userId, consent: true });

    expect(outcome.ok).toBe(true);
    const pairId = outcome.ok ? outcome.pairId : "";
    expect((await getPairForMember(db, pairId, anna.userId))?.members[1].result.id).toBe(boris.resultId);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "pair_created", pairId });
  });

  test("needs a result from the partner", async () => {
    const created = await upsertUserFromIdentity(db, { provider: "vk", externalId: "nores", displayName: "Гена", gender: null }, { version: "v", at: NOW });

    expect(await acceptPair(deps, { token, userId: created.ok ? created.user.id : "", consent: true })).toEqual({ ok: false, error: "no_result" });
  });

  test("passes through repository refusals", async () => {
    expect(await acceptPair(deps, { token, userId: anna.userId, consent: true })).toEqual({ ok: false, error: "own_invite" });
    await acceptPair(deps, { token, userId: boris.userId, consent: true });
    expect(await acceptPair(deps, { token, userId: boris.userId, consent: true })).toEqual({ ok: false, error: "already_used" });
  });

  test("keeps the pair when the queue is down", async () => {
    deps.enqueueNotify = vi.fn().mockRejectedValue(new Error("queue down"));

    expect((await acceptPair(deps, { token, userId: boris.userId, consent: true })).ok).toBe(true);
  });
});

describe("pairReturnPath", () => {
  test("returns to the invite only for a well-formed token", () => {
    expect(pairReturnPath(token)).toBe(`/p/${token}`);
    expect(pairReturnPath("../../evil")).toBeNull();
    expect(pairReturnPath(null)).toBeNull();
    expect(pairReturnPath(undefined)).toBeNull();
  });
});
```

В `apps/web/src/server/http.test.ts` в `describe("cookie options")`:
```ts
  test("keep the pair invite for a day", () => {
    expect(pairCookieOptions("https://grani-test.ru")).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400 });
  });
```
и `pairCookieOptions` в импорт.

В `apps/web/src/server/login-service.test.ts` в `describe("completeLogin")`:
```ts
  test("returns a partner to the pair invite after login, still saving pending answers", async () => {
    const pairInvite = "p".repeat(24);

    const outcome = await completeLogin(deps, ANNA, { ...NO_COOKIES, consent: await giveConsent(deps), pending: await pendingToken(), pairInvite });

    expect(outcome.ok && outcome.redirectTo).toBe(`/p/${pairInvite}`);
    const userId = outcome.ok ? await verifySession(outcome.sessionToken, ENV.SESSION_SECRET) : null;
    expect(userId && (await getLatestResultId(db, userId))).toMatch(/^[0-9a-f-]{36}$/);
  });
```
и `getLatestResultId` в импорт из `@grani/db/testing`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/pairs-service.test.ts apps/web/src/server/http.test.ts apps/web/src/server/login-service.test.ts
```
Expected: FAIL — нет `./pairs-service`, `pairCookieOptions`; новый тест входа получает `/result/<id>`.

- [ ] **Step 2: Реализация**

В `apps/web/src/server/http.ts`:
```ts
export const PAIR_COOKIE = "grani_pair";
export const pairCookieOptions = (appUrl: string) => options(appUrl, DAY_SECONDS);
```

`apps/web/src/server/pairs-service.ts`:
```ts
import type { Gender, NotifyJob } from "@grani/core";
import {
  acceptPairInvite,
  getLatestResultId,
  getOrCreatePairInvite,
  getPairInviteByToken,
  getResultForOwner,
  isInviteToken,
  type Database,
  type UserRecord,
} from "@grani/db";
import { firstName } from "./friends-service";

export type PairsDeps = { db: Database; now: () => Date; enqueueNotify: (job: NotifyJob) => Promise<void> };
export type PairInvitePage =
  | { state: "not_found" }
  | { state: "used"; inviterFirstName: string }
  | { state: "own"; token: string }
  | { state: "needs_login"; inviterFirstName: string; token: string }
  | { state: "needs_result"; inviterFirstName: string; token: string }
  | { state: "ready"; inviterFirstName: string; inviterGender: Gender; token: string };
export type AcceptPairOutcome =
  | { ok: true; pairId: string }
  | { ok: false; error: "consent_required" | "no_result" | "not_found" | "own_invite" | "already_used" | "already_paired" };

export async function createPairInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null> {
  const result = await getResultForOwner(db, p.resultId, p.userId);
  return result ? (await getOrCreatePairInvite(db, { userId: p.userId, resultId: result.id })).token : null;
}

export async function getPairInvitePage(db: Database, token: string, viewer: UserRecord | null): Promise<PairInvitePage> {
  const invite = await getPairInviteByToken(db, token);
  if (!invite) return { state: "not_found" };
  const inviterFirstName = firstName(invite.inviter.displayName);
  if (invite.status !== "open") return { state: "used", inviterFirstName };
  if (viewer?.id === invite.inviter.id) return { state: "own", token };
  if (!viewer) return { state: "needs_login", inviterFirstName, token };
  const resultId = await getLatestResultId(db, viewer.id);
  // Пол пригласившего нужен только для подписи согласия («а я — её/его»)
  return resultId ? { state: "ready", inviterFirstName, inviterGender: invite.inviter.gender, token } : { state: "needs_result", inviterFirstName, token };
}

export async function acceptPair(deps: PairsDeps, p: { token: string; userId: string; consent: boolean }): Promise<AcceptPairOutcome> {
  if (!p.consent) return { ok: false, error: "consent_required" };
  const partnerResultId = await getLatestResultId(deps.db, p.userId);
  if (!partnerResultId) return { ok: false, error: "no_result" };
  const outcome = await acceptPairInvite(deps.db, { token: p.token, partnerUserId: p.userId, partnerResultId, consentAt: deps.now() });
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  // Пара уже создана: без очереди оба узнают о ней на сайте
  await deps.enqueueNotify({ kind: "pair_created", pairId: outcome.pairId }).catch((error: unknown) => {
    console.error("pair notification was not enqueued", { pairId: outcome.pairId, error: String(error) });
  });
  return outcome;
}

export function pairReturnPath(pairCookie: string | null | undefined): string | null {
  return pairCookie && isInviteToken(pairCookie) ? `/p/${pairCookie}` : null;
}
```

В `apps/web/src/server/login-service.ts`:
- `LoginCookies` дополнить необязательным полем `pairInvite?: string | null;`;
- импорт `import { pairReturnPath } from "./pairs-service";`;
- в `completeLogin` заменить `redirectTo: resultId ? … : "/test"` на
```ts
    // Партнёр, пришедший по приглашению, возвращается к согласию; отложенные ответы уже сохранены выше
    redirectTo: pairReturnPath(cookies.pairInvite) ?? (resultId ? `/result/${resultId}` : "/test"),
```

В `apps/web/src/server/login-response.ts` в `readLoginCookies` добавить `pairInvite: request.cookies.get(PAIR_COOKIE)?.value ?? null,` и `PAIR_COOKIE` в импорт из `./http`.

В `apps/web/src/app/api/results/route.ts` строку для `outcome.kind === "saved"` заменить на:
```ts
  if (outcome.kind === "saved") {
    const redirect = pairReturnPath(request.cookies.get(PAIR_COOKIE)?.value) ?? `/result/${outcome.resultId}`;
    return NextResponse.json({ ok: true, redirect });
  }
```
с импортами `PAIR_COOKIE` из `@/server/http` и `pairReturnPath` из `@/server/pairs-service`.

- [ ] **Step 3: Маршруты**

`apps/web/src/app/api/pairs/invites/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { createPairInviteForOwner } from "@/server/pairs-service";
import { clientKeyFromHeaders, invitesLimiter } from "@/server/rate-limit";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!invitesLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const resultId = typeof body === "object" && body !== null ? (body as { resultId?: unknown }).resultId : null;
  const token = typeof resultId === "string" ? await createPairInviteForOwner(deps.db, { userId: user.id, resultId }) : null;
  if (!token) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, url: new URL(`/p/${token}`, deps.env.APP_URL).toString() });
}
```

`apps/web/src/app/api/pairs/join/route.ts`:
```ts
import { isInviteToken } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { PAIR_COOKIE, pairCookieOptions } from "@/server/http";

const NEXT_PATHS: Readonly<Record<string, string>> = { test: "/test", login: "/login" };

export async function GET(request: NextRequest) {
  const env = getEnv();
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const next = NEXT_PATHS[request.nextUrl.searchParams.get("next") ?? ""];
  if (!isInviteToken(token) || !next) {
    return NextResponse.redirect(new URL(`/p/${encodeURIComponent(token)}`, env.APP_URL), 303);
  }
  const response = NextResponse.redirect(new URL(next, env.APP_URL), 303);
  response.cookies.set(PAIR_COOKIE, token, pairCookieOptions(env.APP_URL));
  return response;
}
```

`apps/web/src/app/api/pairs/accept/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, isSameOrigin, PAIR_COOKIE, pairCookieOptions, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { acceptPair, type AcceptPairOutcome } from "@/server/pairs-service";
import { enqueueNotify } from "@/server/queue";

const STATUS: Record<Extract<AcceptPairOutcome, { ok: false }>["error"], number> = {
  consent_required: 400,
  no_result: 400,
  not_found: 404,
  own_invite: 409,
  already_used: 409,
  already_paired: 409,
};

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const { token, consent } = typeof body === "object" && body !== null ? (body as { token?: unknown; consent?: unknown }) : {};

  const outcome = await acceptPair(
    { db: deps.db, now: deps.now, enqueueNotify },
    { token: typeof token === "string" ? token : "", userId: user.id, consent: consent === true },
  );
  if (!outcome.ok) return NextResponse.json({ ok: false, error: outcome.error }, { status: STATUS[outcome.error] });
  const response = NextResponse.json({ ok: true, redirect: `/pair/${outcome.pairId}` });
  response.cookies.set(PAIR_COOKIE, "", expiredCookieOptions(pairCookieOptions(deps.env.APP_URL)));
  return response;
}
```

`apps/web/src/app/api/pairs/[id]/leave/route.ts`:
```ts
import { leavePair } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.redirect(new URL("/login", deps.env.APP_URL), 303);
  const { id } = await params;
  // Повторный выход или чужая пара — тот же переход: не выдаём, существует ли пара
  await leavePair(deps.db, id, user.id);
  return NextResponse.redirect(new URL("/me", deps.env.APP_URL), 303);
}
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add apps/web/src/server apps/web/src/app/api/pairs apps/web/src/app/api/results
git commit -m "feat(web): partner invites with one-time links, consent, return after test and login, leaving a pair"
```
