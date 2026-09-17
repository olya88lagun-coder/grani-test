# Task 3: Сервис друзей — ссылка, метка устройства, ответы, сравнение

**Files:**
- Create: `packages/core/src/queues.ts`, `apps/web/src/server/device.ts`, `apps/web/src/server/friends-service.ts`, `apps/web/src/server/queue.ts`
- Create: `apps/web/src/app/api/invites/route.ts`, `apps/web/src/app/api/f/[token]/route.ts`
- Modify: `packages/core/src/index.ts`, `apps/web/src/server/http.ts`, `apps/web/src/server/rate-limit.ts`, `apps/web/package.json`
- Test: `packages/core/src/queues.test.ts`, `apps/web/src/server/device.test.ts`, `apps/web/src/server/friends-service.test.ts`

**Interfaces:**
- Consumes: `FRIEND_ITEMS`, `friendItemText` (`@grani/content`); `scoreItems`, `compareWithFriends`, `MIN_FRIENDS`, `FriendComparison`, `Answers`, `Gender` (`@grani/core`); `getOrCreateInvite`, `getInviteForResult`, `getInviteByToken`, `addFriendResponse`, `listFriendAnswers`, `countFriendResponses`, `getResultForOwner`, `seedUserWithResult` (Task 1, план 3); `isAnswer`-проверка из `results-service.ts`; `getCurrentUser`, `loginDeps` (план 3).
- Produces:
  ```ts
  // packages/core/src/queues.ts
  const QUEUES: { notify: "notify" };
  type NotifyJob = { kind: "friend_answered"; inviteId: string; friendsCount: number } | { kind: "pair_created"; pairId: string };
  const NOTIFY_JOB_OPTIONS: { retryLimit: 3; retryDelay: 60; retryBackoff: true; expireInSeconds: 120 };
  function notifyJobKey(job: NotifyJob): string; // "friend_answered:<inviteId>:<N>" | "pair_created:<pairId>"

  // server/device.ts
  const DEVICE_COOKIE = "grani_device";
  function newDeviceId(): string;
  function isDeviceId(value: string | undefined): value is string;
  function deviceHash(secret: string, deviceId: string): string;
  function deviceCookieOptions(appUrl: string): CookieOptions; // 1 год

  // server/friends-service.ts
  type FriendsDeps = { db: Database; secret: string; enqueueNotify: (job: NotifyJob) => Promise<void> };
  type FriendsSummary = { inviteToken: string | null; friendsCount: number; needed: number; comparison: FriendComparison | null };
  type FriendPage = { token: string; ownerFirstName: string; ownerGender: Gender; items: readonly { id: string; text: string }[] };
  type FriendSubmitOutcome =
    | { kind: "added"; friendsCount: number }
    | { kind: "duplicate" } | { kind: "invalid" } | { kind: "not_found" } | { kind: "own_invite" };
  function parseFriendAnswers(raw: unknown): Answers | null;
  function firstName(displayName: string): string;
  function createInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null>; // токен
  function getFriendPage(db: Database, token: string): Promise<FriendPage | null>;
  function submitFriendAnswers(deps: FriendsDeps, p: { token: string; raw: unknown; deviceId: string; viewerUserId: string | null }): Promise<FriendSubmitOutcome>;
  function getFriendsSummary(db: Database, resultId: string): Promise<FriendsSummary>;

  // server/queue.ts
  function enqueueNotify(job: NotifyJob): Promise<void>; // ошибки только в лог

  // rate-limit.ts
  const friendsLimiter: RateLimiter;  // 10 ответов в минуту на адрес
  const invitesLimiter: RateLimiter;  // 20 созданий ссылок в минуту на адрес
  ```

Маршруты:
- `POST /api/invites` — тело `{ resultId }`, нужен вход; ответ `{ ok: true, url }` (полная ссылка `APP_URL/f/<token>`) или `{ ok: false, error: "bad_origin" | "rate_limited" | "unauthorized" | "not_found" }` со статусами 403, 429, 401, 404.
- `POST /api/f/<token>` — тело `{ answers }`, вход не нужен; ответ `{ ok: true, redirect: "/f/<token>/done" }` или `{ ok: false, error: "bad_origin" | "rate_limited" | "invalid_answers" | "not_found" | "already_answered" | "own_invite" }` со статусами 403, 429, 400, 404, 409, 403. Если у браузера нет метки `grani_device`, маршрут создаёт её и ставит cookie в ответе.

Сравнение (спецификация 3.3): балл владельца считается по **тем же 20 вопросам**, что и у друзей, — `scoreItems(FRIEND_ITEMS, ownerAnswers)`; баллы друзей — `scoreItems(FRIEND_ITEMS, answers)` у каждого; среднее, разница и заметность — `compareWithFriends` из ядра. Пока ответов меньше трёх, `comparison` — `null`, а `needed` показывает, сколько ещё нужно.

Уведомление ставится только при новом ответе (`added`). Ключ задачи содержит число ответов, поэтому повторная постановка той же задачи не создаёт вторую.

- [ ] **Step 1: Тесты (падают)**

`packages/core/src/queues.test.ts`:
```ts
import { expect, test } from "vitest";
import { notifyJobKey, QUEUES } from "./queues";

test("notification jobs have stable keys so a job is enqueued once", () => {
  expect(QUEUES.notify).toBe("notify");
  expect(notifyJobKey({ kind: "friend_answered", inviteId: "i1", friendsCount: 3 })).toBe("friend_answered:i1:3");
  expect(notifyJobKey({ kind: "pair_created", pairId: "p1" })).toBe("pair_created:p1");
});
```

`apps/web/src/server/device.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { deviceCookieOptions, deviceHash, isDeviceId, newDeviceId } from "./device";

describe("device marker", () => {
  test("is a random uuid", () => {
    const id = newDeviceId();

    expect(isDeviceId(id)).toBe(true);
    expect(newDeviceId()).not.toBe(id);
    expect(isDeviceId("not-a-uuid")).toBe(false);
    expect(isDeviceId(undefined)).toBe(false);
  });

  test("is stored only as a secret-keyed hash", () => {
    const id = newDeviceId();

    expect(deviceHash("s".repeat(40), id)).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceHash("s".repeat(40), id)).toBe(deviceHash("s".repeat(40), id));
    expect(deviceHash("t".repeat(40), id)).not.toBe(deviceHash("s".repeat(40), id));
    expect(deviceHash("s".repeat(40), id)).not.toContain(id);
  });

  test("lives for a year", () => {
    expect(deviceCookieOptions("https://grani-test.ru")).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  });
});
```

`apps/web/src/server/friends-service.test.ts`:
```ts
import { FRIEND_ITEMS } from "@grani/content";
import type { Answers } from "@grani/core";
import { countFriendResponses, createTestDb, getInviteForResult, seedUserWithResult, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { newDeviceId } from "./device";
import {
  createInviteForOwner,
  firstName,
  getFriendPage,
  getFriendsSummary,
  parseFriendAnswers,
  submitFriendAnswers,
  type FriendsDeps,
} from "./friends-service";

const SECRET = "s".repeat(40);
const friendAnswers = (value: number) => Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, value])) as Answers;

let db: Database;
let deps: FriendsDeps;
let owner: { userId: string; resultId: string };
let token: string;

async function answer(value: number, deviceId = newDeviceId(), viewerUserId: string | null = null) {
  return submitFriendAnswers(deps, { token, raw: friendAnswers(value), deviceId, viewerUserId });
}

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, secret: SECRET, enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  owner = await seedUserWithResult(db, { externalId: "owner", displayName: "Аня Петрова", gender: "female" });
  token = (await createInviteForOwner(db, owner))!;
});

describe("parseFriendAnswers", () => {
  test("accepts exactly the 20 friend questions with answers 1–5", () => {
    expect(parseFriendAnswers(friendAnswers(4))).toEqual(friendAnswers(4));
  });

  test.each([
    ["a missing answer", Object.fromEntries(FRIEND_ITEMS.slice(1).map((item) => [item.id, 3]))],
    ["a self-test question", { ...friendAnswers(3), "ipip-05": 3 }],
    ["a value out of range", { ...friendAnswers(3), "ipip-01": 0 }],
    ["not an object", "5"],
  ])("rejects %s", (_, raw) => {
    expect(parseFriendAnswers(raw)).toBeNull();
  });
});

describe("firstName", () => {
  test("keeps only the first word", () => {
    expect(firstName("Аня Петрова")).toBe("Аня");
    expect(firstName("  Борис ")).toBe("Борис");
    expect(firstName("")).toBe("Друг");
  });
});

describe("createInviteForOwner", () => {
  test("creates the link only for the owner of the result", async () => {
    const stranger = await seedUserWithResult(db, { externalId: "stranger" });

    expect(await createInviteForOwner(db, owner)).toBe(token);
    expect(await createInviteForOwner(db, { userId: stranger.userId, resultId: owner.resultId })).toBeNull();
  });
});

describe("getFriendPage", () => {
  test("shows the owner's first name and questions about them", async () => {
    const page = await getFriendPage(db, token);

    expect(page).toMatchObject({ token, ownerFirstName: "Аня", ownerGender: "female" });
    expect(page?.items).toHaveLength(20);
    expect(page?.items[0]?.text).toContain("Аня");
    expect(JSON.stringify(page)).not.toContain("scores");
  });

  test("returns null for a broken link", async () => {
    expect(await getFriendPage(db, "z".repeat(24))).toBeNull();
  });
});

describe("submitFriendAnswers", () => {
  test("stores an answer and enqueues a notification with the new count", async () => {
    const outcome = await answer(4);

    expect(outcome).toEqual({ kind: "added", friendsCount: 1 });
    const invite = await getInviteForResult(db, owner.resultId);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "friend_answered", inviteId: invite?.id, friendsCount: 1 });
  });

  test("accepts one answer per browser", async () => {
    const deviceId = newDeviceId();
    await answer(4, deviceId);

    expect(await answer(2, deviceId)).toEqual({ kind: "duplicate" });
    expect(deps.enqueueNotify).toHaveBeenCalledTimes(1);
  });

  test("does not let the owner answer about themselves", async () => {
    expect(await answer(5, newDeviceId(), owner.userId)).toEqual({ kind: "own_invite" });
  });

  test("rejects invalid answers and unknown links without saving", async () => {
    expect(await submitFriendAnswers(deps, { token, raw: { "ipip-01": 5 }, deviceId: newDeviceId(), viewerUserId: null })).toEqual({ kind: "invalid" });
    expect(await submitFriendAnswers(deps, { token: "q".repeat(24), raw: friendAnswers(3), deviceId: newDeviceId(), viewerUserId: null })).toEqual({ kind: "not_found" });

    const invite = await getInviteForResult(db, owner.resultId);
    expect(await countFriendResponses(db, invite!.id)).toBe(0);
  });

  test("still saves the answer when the queue is down", async () => {
    deps.enqueueNotify = vi.fn().mockRejectedValue(new Error("queue down"));

    expect((await answer(3)).kind).toBe("added");
  });
});

describe("getFriendsSummary", () => {
  test("has no link and nothing to compare before the owner shares it", async () => {
    const other = await seedUserWithResult(db, { externalId: "other" });

    expect(await getFriendsSummary(db, other.resultId)).toEqual({ inviteToken: null, friendsCount: 0, needed: 3, comparison: null });
  });

  test("hides the comparison until three friends answered", async () => {
    await answer(5);
    await answer(5);

    expect(await getFriendsSummary(db, owner.resultId)).toEqual({ inviteToken: token, friendsCount: 2, needed: 1, comparison: null });
  });

  test("compares the owner and the friends on the same 20 questions", async () => {
    // У владельца все ответы «3» → 50 по каждой черте. Друзья отвечают «5»: в каждой четвёрке 2 прямых и 2 обратных
    // вопроса, поэтому тоже 50 — разницы нет
    await answer(5);
    await answer(5);
    await answer(5);

    const summary = await getFriendsSummary(db, owner.resultId);

    expect(summary.friendsCount).toBe(3);
    expect(summary.needed).toBe(0);
    expect(summary.comparison?.traits.extraversion).toEqual({ self: 50, friends: 50, diff: 0, notable: false });
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/queues.test.ts apps/web/src/server/device.test.ts apps/web/src/server/friends-service.test.ts
```
Expected: FAIL — модулей нет.

- [ ] **Step 2: Реализация**

`packages/core/src/queues.ts`:
```ts
export const QUEUES = { notify: "notify" } as const;

export type NotifyJob =
  | { kind: "friend_answered"; inviteId: string; friendsCount: number }
  | { kind: "pair_created"; pairId: string };

// Уведомление — не критичное действие: три попытки с растущей паузой, дальше задача остаётся failed для разбора в логах
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 120 } as const;

export function notifyJobKey(job: NotifyJob): string {
  return job.kind === "friend_answered" ? `friend_answered:${job.inviteId}:${job.friendsCount}` : `pair_created:${job.pairId}`;
}
```
В `packages/core/src/index.ts` добавить `export * from "./queues";`.

`apps/web/src/server/device.ts`:
```ts
import { createHmac, randomUUID } from "node:crypto";
import type { CookieOptions } from "./http";

export const DEVICE_COOKIE = "grani_device";
const DEVICE_MAX_AGE_SECONDS = 365 * 86400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newDeviceId(): string {
  return randomUUID();
}

export function isDeviceId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// В базе только HMAC метки: по базе нельзя узнать, какому браузеру принадлежит ответ
export function deviceHash(secret: string, deviceId: string): string {
  return createHmac("sha256", secret).update(`device:${deviceId}`).digest("hex");
}

export function deviceCookieOptions(appUrl: string): CookieOptions {
  return { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE_SECONDS };
}
```

`apps/web/src/server/friends-service.ts`:
```ts
import { FRIEND_ITEMS, friendItemText } from "@grani/content";
import { compareWithFriends, MIN_FRIENDS, scoreItems, type Answers, type FriendComparison, type Gender, type NotifyJob } from "@grani/core";
import {
  addFriendResponse,
  countFriendResponses,
  getInviteByToken,
  getInviteForResult,
  getOrCreateInvite,
  getResultForOwner,
  listFriendAnswers,
  type Database,
} from "@grani/db";
import { deviceHash } from "./device";
import { parseAnswersFor } from "./results-service";

export type FriendsDeps = { db: Database; secret: string; enqueueNotify: (job: NotifyJob) => Promise<void> };
export type FriendsSummary = { inviteToken: string | null; friendsCount: number; needed: number; comparison: FriendComparison | null };
export type FriendPage = { token: string; ownerFirstName: string; ownerGender: Gender; items: readonly { id: string; text: string }[] };
export type FriendSubmitOutcome =
  | { kind: "added"; friendsCount: number }
  | { kind: "duplicate" }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "own_invite" };

const FRIEND_ITEM_IDS: ReadonlySet<string> = new Set(FRIEND_ITEMS.map((item) => item.id));
const FALLBACK_NAME = "Друг";

export function parseFriendAnswers(raw: unknown): Answers | null {
  return parseAnswersFor(FRIEND_ITEM_IDS, raw);
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || FALLBACK_NAME;
}

export async function createInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null> {
  const result = await getResultForOwner(db, p.resultId, p.userId);
  return result ? (await getOrCreateInvite(db, result.id)).token : null;
}

export async function getFriendPage(db: Database, token: string): Promise<FriendPage | null> {
  const invite = await getInviteByToken(db, token);
  if (!invite) return null;
  const name = firstName(invite.owner.displayName);
  return {
    token,
    ownerFirstName: name,
    ownerGender: invite.owner.gender,
    items: FRIEND_ITEMS.map((item) => ({ id: item.id, text: friendItemText(item, name) })),
  };
}

export async function submitFriendAnswers(
  deps: FriendsDeps,
  p: { token: string; raw: unknown; deviceId: string; viewerUserId: string | null },
): Promise<FriendSubmitOutcome> {
  const invite = await getInviteByToken(deps.db, p.token);
  if (!invite) return { kind: "not_found" };
  if (p.viewerUserId === invite.owner.id) return { kind: "own_invite" };
  const answers = parseFriendAnswers(p.raw);
  if (!answers) return { kind: "invalid" };

  const stored = await addFriendResponse(deps.db, { inviteId: invite.id, answers, deviceHash: deviceHash(deps.secret, p.deviceId) });
  if (stored === "duplicate") return { kind: "duplicate" };

  const friendsCount = await countFriendResponses(deps.db, invite.id);
  // Ответ уже сохранён: без очереди владелец просто узнает о нём на сайте
  await deps.enqueueNotify({ kind: "friend_answered", inviteId: invite.id, friendsCount }).catch((error: unknown) => {
    console.error("friend notification was not enqueued", { inviteId: invite.id, error: String(error) });
  });
  return { kind: "added", friendsCount };
}

export async function getFriendsSummary(db: Database, resultId: string): Promise<FriendsSummary> {
  const invite = await getInviteForResult(db, resultId);
  if (!invite) return { inviteToken: null, friendsCount: 0, needed: MIN_FRIENDS, comparison: null };
  const friendAnswers = await listFriendAnswers(db, invite.id);
  const friendsCount = friendAnswers.length;
  const base = { inviteToken: invite.token, friendsCount, needed: Math.max(0, MIN_FRIENDS - friendsCount) };
  if (friendsCount < MIN_FRIENDS) return { ...base, comparison: null };

  const context = await getInviteByToken(db, invite.token);
  if (!context) return { ...base, comparison: null };
  const selfSubset = scoreItems(FRIEND_ITEMS, context.ownerAnswers);
  const friendScores = friendAnswers.map((answers) => scoreItems(FRIEND_ITEMS, answers));
  return { ...base, comparison: compareWithFriends(selfSubset, friendScores) };
}
```

В `apps/web/src/server/results-service.ts` вынести проверку набора ответов в общую функцию, `parseAnswers` оставить обёрткой:
```ts
export function parseAnswersFor(ids: ReadonlySet<string>, raw: unknown): Answers | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length !== ids.size) return null;
  for (const [id, value] of entries) if (!ids.has(id) || !isAnswer(value)) return null;
  return Object.fromEntries(entries) as Answers;
}

export function parseAnswers(raw: unknown): Answers | null {
  return parseAnswersFor(ITEM_IDS, raw);
}
```

В `apps/web/src/server/rate-limit.ts`:
```ts
const FRIEND_ANSWERS_PER_MINUTE = 10;
const INVITES_PER_MINUTE = 20;

export const friendsLimiter = createRateLimiter({ limit: FRIEND_ANSWERS_PER_MINUTE, windowMs: MINUTE_MS });
export const invitesLimiter = createRateLimiter({ limit: INVITES_PER_MINUTE, windowMs: MINUTE_MS });
```

`apps/web/package.json` — в `dependencies` добавить `"pg-boss": "12.31.1"`:
```bash
pnpm --filter @grani/web add pg-boss@12.31.1
```

`apps/web/src/server/queue.ts` (по образцу `C:\dev\wishlist\apps\web\src\server\queue.ts`):
```ts
import { createHash } from "node:crypto";
import { NOTIFY_JOB_OPTIONS, notifyJobKey, QUEUES, type NotifyJob } from "@grani/core";
import { PgBoss } from "pg-boss";
import { getEnv } from "./env";

const holder = globalThis as typeof globalThis & { __graniQueue?: Promise<PgBoss> };

function queue(): Promise<PgBoss> {
  holder.__graniQueue ??= (async () => {
    // Только отправка: схему pg-boss и очереди создаёт воркер
    const boss = new PgBoss({ connectionString: getEnv().DATABASE_URL, max: 1, supervise: false, schedule: false, migrate: false });
    boss.on("error", (error) => console.error("queue error", String(error)));
    await boss.start();
    return boss;
  })().catch((error: unknown) => {
    holder.__graniQueue = undefined;
    throw error;
  });
  return holder.__graniQueue;
}

// Одинаковый ключ → одинаковый id задачи: pg-boss не вставит её второй раз
function jobIdFor(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function enqueueNotify(job: NotifyJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.notify, job, { ...NOTIFY_JOB_OPTIONS, id: jobIdFor(notifyJobKey(job)) });
  } catch (error) {
    // Действие пользователя уже сохранено; потерянное уведомление не должно его ломать
    console.error("enqueue notify failed", { kind: job.kind, error: String(error) });
  }
}
```

- [ ] **Step 3: Маршруты**

`apps/web/src/app/api/invites/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { createInviteForOwner } from "@/server/friends-service";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
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
  const token = typeof resultId === "string" ? await createInviteForOwner(deps.db, { userId: user.id, resultId }) : null;
  if (!token) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, url: new URL(`/f/${token}`, deps.env.APP_URL).toString() });
}
```

`apps/web/src/app/api/f/[token]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { DEVICE_COOKIE, deviceCookieOptions, isDeviceId, newDeviceId } from "@/server/device";
import { submitFriendAnswers, type FriendSubmitOutcome } from "@/server/friends-service";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { enqueueNotify } from "@/server/queue";
import { clientKeyFromHeaders, friendsLimiter } from "@/server/rate-limit";

const ERRORS: Record<Exclude<FriendSubmitOutcome["kind"], "added">, { error: string; status: number }> = {
  invalid: { error: "invalid_answers", status: 400 },
  not_found: { error: "not_found", status: 404 },
  duplicate: { error: "already_answered", status: 409 },
  own_invite: { error: "own_invite", status: 403 },
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!friendsLimiter.allow(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const { token } = await params;
  const stored = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = isDeviceId(stored) ? stored : newDeviceId();
  const viewer = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  const body: unknown = await request.json().catch(() => null);
  const raw = typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : null;

  const outcome = await submitFriendAnswers(
    { db: deps.db, secret: deps.env.SESSION_SECRET, enqueueNotify },
    { token, raw, deviceId, viewerUserId: viewer?.id ?? null },
  );
  const response =
    outcome.kind === "added"
      ? NextResponse.json({ ok: true, redirect: `/f/${token}/done` })
      : NextResponse.json({ ok: false, error: ERRORS[outcome.kind].error }, { status: ERRORS[outcome.kind].status });
  if (stored !== deviceId) response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions(deps.env.APP_URL));
  return response;
}
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/queues.ts packages/core/src/queues.test.ts packages/core/src/index.ts apps/web/package.json pnpm-lock.yaml apps/web/src/server apps/web/src/app/api/invites apps/web/src/app/api/f
git commit -m "feat(web): friend invite links, one answer per browser, comparison after three friends"
```
