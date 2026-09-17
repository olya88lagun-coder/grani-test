# Task 5: Сервис результатов — проверка ответов, расчёт, сохранение

**Files:**
- Create: `apps/web/src/server/rate-limit.ts`, `apps/web/src/server/results-service.ts`, `apps/web/src/app/api/results/route.ts`
- Test: `apps/web/src/server/rate-limit.test.ts`, `apps/web/src/server/results-service.test.ts`

**Interfaces:**
- Consumes: `SELF_ITEMS` (`@grani/content`); `scoreItems`, `typeCodeOf`, `stabilityOf`, `Answers`, `Answer`, `TraitScores`, `TypeCode`, `Stability` (`@grani/core`); `createResult`, `getUser`, `Database` (Task 2); `signPending`, `verifyPending`, `verifySession` (Task 4); `getEnv`, `getDb`, `isSameOrigin`, `PENDING_COOKIE`, `SESSION_COOKIE`, `pendingCookieOptions` (Task 3).
- Produces:
  ```ts
  // rate-limit.ts
  type RateLimiter = { allow(key: string): boolean };
  function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter;
  const resultsLimiter: RateLimiter; // 20 запросов в минуту на ключ
  function clientKeyFromHeaders(headers: Headers): string; // первый адрес из x-forwarded-for или "unknown"

  // results-service.ts
  type ComputedResult = { scores: TraitScores; typeCode: TypeCode; stability: Stability };
  type ResultsDeps = { db: Database; secret: string };
  type SubmitOutcome = { kind: "saved"; resultId: string } | { kind: "pending"; pendingToken: string } | { kind: "invalid" };
  function parseAnswers(raw: unknown): Answers | null;
  function computeResult(answers: Answers): ComputedResult;
  function submitAnswers(deps: ResultsDeps, raw: unknown, sessionToken: string | null): Promise<SubmitOutcome>;
  function savePendingResult(deps: ResultsDeps, userId: string, pendingToken: string | null): Promise<string | null>;
  ```

`parseAnswers` принимает только объект, в котором есть ответ на каждый из 50 вопросов `SELF_ITEMS`, каждый ответ — целое 1–5, и нет лишних ключей. Всё остальное — `null`: данные приходят от клиента и из cookie, им нельзя доверять. Отложенные ответы проверяются заново при сохранении, даже если подпись cookie верна.

Маршрут `POST /api/results` отвечает JSON `{ ok: true, redirect: string }` или `{ ok: false, error: "bad_origin" | "rate_limited" | "invalid_answers" }` со статусами 403, 429, 400.

- [ ] **Step 1: Тесты (падают)**

`apps/web/src/server/rate-limit.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { clientKeyFromHeaders, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit within a window and resets after it", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  test("takes the first forwarded address", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "10.0.0.1, 172.16.0.1" }))).toBe("10.0.0.1");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
```

`apps/web/src/server/results-service.test.ts`:
```ts
import { SELF_ITEMS } from "@grani/content";
import { createTestDb, getResultForOwner, upsertUserFromIdentity, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { signPending, signSession, verifyPending } from "./auth/tokens";
import { computeResult, parseAnswers, savePendingResult, submitAnswers } from "./results-service";

const SECRET = "s".repeat(40);
const allAnswers = (value: number) => Object.fromEntries(SELF_ITEMS.map((item) => [item.id, value]));

let db: Database;

async function createUser(): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: "telegram", externalId: "42", displayName: "Аня", gender: null },
    { version: "2026-09-v1", at: new Date() },
  );
  if (!outcome.ok) throw new Error("user was not created");
  return outcome.user.id;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("parseAnswers", () => {
  test("accepts all 50 answers in range", () => {
    expect(parseAnswers(allAnswers(3))).toEqual(allAnswers(3));
  });

  test.each([
    ["a missing answer", Object.fromEntries(SELF_ITEMS.slice(1).map((item) => [item.id, 3]))],
    ["an unknown key", { ...allAnswers(3), extra: 3 }],
    ["an out-of-range value", { ...allAnswers(3), "ipip-07": 6 }],
    ["a fractional value", { ...allAnswers(3), "ipip-07": 2.5 }],
    ["a string value", { ...allAnswers(3), "ipip-07": "5" }],
    ["an array", [1, 2, 3]],
    ["null", null],
  ])("rejects %s", (_, raw) => {
    expect(parseAnswers(raw)).toBeNull();
  });
});

describe("computeResult", () => {
  test("scores IPIP-50 answers, derives the type and the stability note", () => {
    // Все ответы «5»: extraversion 5+/5- → 50; agreeableness и conscientiousness 6+/4- → 60;
    // stability 2+/8- → 20; openness 7+/3- → 70
    const result = computeResult(parseAnswers(allAnswers(5))!);

    expect(result.scores).toEqual({ openness: 70, conscientiousness: 60, extraversion: 50, agreeableness: 60, stability: 20 });
    expect(result.typeCode).toBe("++++");
    expect(result.stability).toBe("sensitive");
  });
});

describe("submitAnswers", () => {
  test("rejects invalid answers", async () => {
    expect(await submitAnswers({ db, secret: SECRET }, { "ipip-01": 5 }, null)).toEqual({ kind: "invalid" });
  });

  test("saves the result right away for a signed-in user", async () => {
    const userId = await createUser();

    const outcome = await submitAnswers({ db, secret: SECRET }, allAnswers(4), await signSession(userId, SECRET));

    expect(outcome.kind).toBe("saved");
    const saved = outcome.kind === "saved" ? await getResultForOwner(db, outcome.resultId, userId) : null;
    expect(saved?.answers).toEqual(allAnswers(4));
  });

  test("returns a pending token for an anonymous visitor", async () => {
    const outcome = await submitAnswers({ db, secret: SECRET }, allAnswers(2), null);

    expect(outcome.kind).toBe("pending");
    expect(outcome.kind === "pending" && (await verifyPending(outcome.pendingToken, SECRET))).toEqual(allAnswers(2));
  });

  test("treats a session of a deleted or unknown user as anonymous", async () => {
    const token = await signSession("00000000-0000-0000-0000-000000000000", SECRET);

    expect((await submitAnswers({ db, secret: SECRET }, allAnswers(2), token)).kind).toBe("pending");
  });
});

describe("savePendingResult", () => {
  test("stores pending answers for the user", async () => {
    const userId = await createUser();
    const token = await signPending(parseAnswers(allAnswers(1))!, SECRET);

    const resultId = await savePendingResult({ db, secret: SECRET }, userId, token);

    expect(resultId && (await getResultForOwner(db, resultId, userId))?.answers).toEqual(allAnswers(1));
  });

  test("ignores a missing, forged or invalid pending token", async () => {
    const userId = await createUser();
    const forged = await signPending(parseAnswers(allAnswers(1))!, "x".repeat(40));
    const incomplete = await signPending({ "ipip-01": 5 }, SECRET);

    expect(await savePendingResult({ db, secret: SECRET }, userId, null)).toBeNull();
    expect(await savePendingResult({ db, secret: SECRET }, userId, forged)).toBeNull();
    expect(await savePendingResult({ db, secret: SECRET }, userId, incomplete)).toBeNull();
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run apps/web/src/server/rate-limit.test.ts apps/web/src/server/results-service.test.ts
```
Expected: FAIL — не найдены `./rate-limit` и `./results-service`.

- [ ] **Step 2: Реализация**

`apps/web/src/server/rate-limit.ts`:
```ts
export type RateLimiter = { allow(key: string): boolean };

const MAX_TRACKED_KEYS = 10_000;
const MINUTE_MS = 60_000;
const RESULTS_PER_MINUTE = 20;

export function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = p.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(key) {
      const current = now();
      if (windows.size > MAX_TRACKED_KEYS) windows.clear();
      const window = windows.get(key);
      if (!window || current - window.startedAt >= p.windowMs) {
        windows.set(key, { startedAt: current, count: 1 });
        return true;
      }
      if (window.count >= p.limit) return false;
      windows.set(key, { startedAt: window.startedAt, count: window.count + 1 });
      return true;
    },
  };
}

export const resultsLimiter = createRateLimiter({ limit: RESULTS_PER_MINUTE, windowMs: MINUTE_MS });

export function clientKeyFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
```

`apps/web/src/server/results-service.ts`:
```ts
import { SELF_ITEMS } from "@grani/content";
import {
  scoreItems,
  stabilityOf,
  typeCodeOf,
  type Answer,
  type Answers,
  type Stability,
  type TraitScores,
  type TypeCode,
} from "@grani/core";
import { createResult, getUser, type Database } from "@grani/db";
import { signPending, verifyPending, verifySession } from "./auth/tokens";

export type ComputedResult = { scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type ResultsDeps = { db: Database; secret: string };
export type SubmitOutcome = { kind: "saved"; resultId: string } | { kind: "pending"; pendingToken: string } | { kind: "invalid" };

const ITEM_IDS = new Set(SELF_ITEMS.map((item) => item.id));
const MIN_ANSWER = 1;
const MAX_ANSWER = 5;

function isAnswer(value: unknown): value is Answer {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_ANSWER && value <= MAX_ANSWER;
}

export function parseAnswers(raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length !== ITEM_IDS.size) return null;
  for (const [id, value] of entries) if (!ITEM_IDS.has(id) || !isAnswer(value)) return null;
  return Object.fromEntries(entries) as Answers;
}

export function computeResult(answers: Answers): ComputedResult {
  const scores = scoreItems(SELF_ITEMS, answers);
  return { scores, typeCode: typeCodeOf(scores), stability: stabilityOf(scores) };
}

async function saveFor(db: Database, userId: string, answers: Answers): Promise<string> {
  const created = await createResult(db, { userId, answers, ...computeResult(answers) });
  return created.id;
}

export async function submitAnswers(deps: ResultsDeps, raw: unknown, sessionToken: string | null): Promise<SubmitOutcome> {
  const answers = parseAnswers(raw);
  if (!answers) return { kind: "invalid" };
  const userId = sessionToken ? await verifySession(sessionToken, deps.secret) : null;
  if (userId && (await getUser(deps.db, userId))) return { kind: "saved", resultId: await saveFor(deps.db, userId, answers) };
  return { kind: "pending", pendingToken: await signPending(answers, deps.secret) };
}

export async function savePendingResult(deps: ResultsDeps, userId: string, pendingToken: string | null): Promise<string | null> {
  if (!pendingToken) return null;
  const answers = parseAnswers(await verifyPending(pendingToken, deps.secret));
  return answers ? saveFor(deps.db, userId, answers) : null;
}
```

`apps/web/src/app/api/results/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { isSameOrigin, PENDING_COOKIE, pendingCookieOptions, SESSION_COOKIE } from "@/server/http";
import { clientKeyFromHeaders, resultsLimiter } from "@/server/rate-limit";
import { submitAnswers } from "@/server/results-service";

export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!resultsLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body: unknown = await request.json().catch(() => null);
  const answers = typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : null;
  const outcome = await submitAnswers(
    { db: getDb(), secret: env.SESSION_SECRET },
    answers,
    request.cookies.get(SESSION_COOKIE)?.value ?? null,
  );
  if (outcome.kind === "invalid") return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  if (outcome.kind === "saved") return NextResponse.json({ ok: true, redirect: `/result/${outcome.resultId}` });
  const response = NextResponse.json({ ok: true, redirect: "/login" });
  response.cookies.set(PENDING_COOKIE, outcome.pendingToken, pendingCookieOptions(env.APP_URL));
  return response;
}
```

- [ ] **Step 3: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add apps/web/src/server/rate-limit.ts apps/web/src/server/rate-limit.test.ts apps/web/src/server/results-service.ts apps/web/src/server/results-service.test.ts apps/web/src/app/api/results
git commit -m "feat(web): validate answers, compute and save results or keep them until login"
```
