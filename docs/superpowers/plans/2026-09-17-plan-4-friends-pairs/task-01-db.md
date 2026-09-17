# Task 1: База — приглашения, ответы друзей, пары, право на уведомления

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/users.ts`, `packages/db/src/testing.ts`, `packages/db/src/index.ts`
- Create: `packages/db/src/tokens.ts`, `packages/db/src/invites.ts`, `packages/db/src/pairs.ts`, `packages/db/src/notify-targets.ts`
- Create (генерируется): `packages/db/drizzle/0001_*.sql`, `packages/db/drizzle/meta/*`
- Test: `packages/db/src/tokens.test.ts`, `packages/db/src/invites.test.ts`, `packages/db/src/pairs.test.ts`, `packages/db/src/notify-targets.test.ts`, `packages/db/src/users.test.ts` (дополнение)

**Interfaces:**
- Consumes: `Answers`, `TraitScores`, `TypeCode`, `Stability` (`@grani/core`); `getUser`, `UserRecord`, `KnownGender`, `AuthProvider`, `isUuid` (план 3).
- Produces:
  ```ts
  // tokens.ts
  function createInviteToken(): string;             // 24 символа base64url
  function isInviteToken(value: string): boolean;

  // invites.ts
  type InviteRecord = { id: string; token: string };
  type InviteContext = { id: string; resultId: string; owner: UserRecord; ownerAnswers: Answers };
  type FriendResponseOutcome = "added" | "duplicate";
  function getOrCreateInvite(db: Database, resultId: string): Promise<InviteRecord>;
  function getInviteForResult(db: Database, resultId: string): Promise<InviteRecord | null>;
  function getInviteByToken(db: Database, token: string): Promise<InviteContext | null>;
  function addFriendResponse(db: Database, p: { inviteId: string; answers: Answers; deviceHash: string }): Promise<FriendResponseOutcome>;
  function listFriendAnswers(db: Database, inviteId: string): Promise<Answers[]>;
  function countFriendResponses(db: Database, inviteId: string): Promise<number>;

  // pairs.ts
  type PairInviteContext = { id: string; token: string; status: "open" | "accepted"; inviter: UserRecord; inviterResultId: string };
  type PairResult = { id: string; scores: TraitScores; typeCode: TypeCode; stability: Stability };
  type PairMember = { user: UserRecord; result: PairResult };
  type PairRecord = { id: string; createdAt: Date; members: readonly [PairMember, PairMember] }; // [пригласивший, партнёр]
  type AcceptOutcome = { ok: true; pairId: string } | { ok: false; reason: "not_found" | "own_invite" | "already_used" | "already_paired" };
  type ActivePair = { id: string; partner: UserRecord; createdAt: Date };
  function getOrCreatePairInvite(db: Database, p: { userId: string; resultId: string }): Promise<InviteRecord>;
  function getPairInviteByToken(db: Database, token: string): Promise<PairInviteContext | null>;
  function acceptPairInvite(db: Database, p: { token: string; partnerUserId: string; partnerResultId: string; consentAt: Date }): Promise<AcceptOutcome>;
  function getPairForMember(db: Database, pairId: string, userId: string): Promise<PairRecord | null>;
  function leavePair(db: Database, pairId: string, userId: string): Promise<boolean>;
  function listActivePairs(db: Database, userId: string): Promise<ActivePair[]>;

  // notify-targets.ts
  type NotifyTarget = { provider: AuthProvider; externalId: string };
  function getNotifyTargets(db: Database, userId: string): Promise<NotifyTarget[]>;
  function setCanNotify(db: Database, p: NotifyTarget & { canNotify: boolean }): Promise<void>;
  function getFriendAnsweredNotice(db: Database, inviteId: string): Promise<{ ownerUserId: string; resultId: string; friendsCount: number } | null>;

  // testing.ts
  function seedUserWithResult(db: Database, p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null; scores?: TraitScores }): Promise<{ userId: string; resultId: string }>;
  ```

Схема — раздел 5.2 спецификации. Ссылка для друзей привязана к результату (у результата одна ссылка, `invites.result_id` уникален), ответы друзей — к ссылке. Приглашение партнёра привязано к результату пригласившего; у одного результата одновременно одно открытое приглашение. Пара ссылается на приглашение (`pairs.invite_id` уникален) и на результаты обоих на момент согласия. Выход из пары — `left_at`, запись не удаляется. Все внешние ключи — `on delete cascade`: удаление пользователя (план 6) уносит его ссылки, ответы друзей о нём и пары.

Ответы друзей наружу отдаёт только `listFriendAnswers` — его вызывает сервис сравнения, который возвращает среднее. Ни один маршрут не отдаёт отдельные ответы.

- [ ] **Step 0: Ветка**

```bash
cd /c/dev/grani-test
git checkout master && git pull --ff-only
git checkout -b feat/friends-pairs
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
```

- [ ] **Step 1: Схема и миграция**

В `packages/db/src/schema.ts`:

1. Добавить `boolean`, `check` в импорт из `drizzle-orm/pg-core` и `sql` из `drizzle-orm`.
2. В `authIdentities` после `displayName` добавить колонку:
```ts
    canNotify: boolean("can_notify").notNull().default(false),
```
3. В конец файла:
```ts
export const pairInviteStatusEnum = pgEnum("pair_invite_status", ["open", "accepted"]);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id")
    .notNull()
    .unique()
    .references(() => results.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
});

export const friendResponses = pgTable(
  "friend_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull(),
    deviceHash: text("device_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("friend_responses_invite_device_uq").on(t.inviteId, t.deviceHash)],
);

export const pairInvites = pgTable(
  "pair_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviterResultId: uuid("inviter_result_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    status: pairInviteStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("pair_invites_result_idx").on(t.inviterResultId)],
);

export const pairs = pgTable(
  "pairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .unique()
      .references(() => pairInvites.id, { onDelete: "cascade" }),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resultAId: uuid("result_a_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resultBId: uuid("result_b_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    partnerConsentAt: timestamp("partner_consent_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("pairs_user_a_idx").on(t.userAId),
    index("pairs_user_b_idx").on(t.userBId),
    check("pairs_different_users", sql`${t.userAId} <> ${t.userBId}`),
  ],
);
```

```bash
pnpm --filter @grani/db db:generate
```
Expected: `packages/db/drizzle/0001_<имя>.sql` с `CREATE TYPE "public"."pair_invite_status"`, четырьмя `CREATE TABLE` и `ALTER TABLE "auth_identities" ADD COLUMN "can_notify" boolean DEFAULT false NOT NULL`.

- [ ] **Step 2: Помощник для тестов**

В `packages/db/src/testing.ts` перед `export * from "./index";`:
```ts
const DEFAULT_SCORES = { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 };

// Пользователь с согласием и одним результатом — общая подготовка для тестов репозиториев и сервисов
export async function seedUserWithResult(
  db: Database,
  p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null; scores?: TraitScores },
): Promise<{ userId: string; resultId: string }> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: p.provider ?? "telegram", externalId: p.externalId, displayName: p.displayName ?? p.externalId, gender: p.gender ?? null },
    { version: "test", at: new Date("2026-09-17T10:00:00Z") },
  );
  if (!outcome.ok) throw new Error("seed user was not created");
  const scores = p.scores ?? DEFAULT_SCORES;
  const result = await createResult(db, {
    userId: outcome.user.id,
    answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 3 as const])),
    scores,
    typeCode: typeCodeOf(scores),
    stability: stabilityOf(scores),
  });
  return { userId: outcome.user.id, resultId: result.id };
}
```
и импорты:
```ts
import { stabilityOf, typeCodeOf, type TraitScores } from "@grani/core";
import { createResult } from "./results";
import type { AuthProvider } from "./schema";
import { upsertUserFromIdentity, type KnownGender } from "./users";
```

- [ ] **Step 3: Тесты (падают)**

`packages/db/src/tokens.test.ts`:
```ts
import { expect, test } from "vitest";
import { createInviteToken, isInviteToken } from "./tokens";

test("invite tokens are 24 url-safe characters and unique", () => {
  const tokens = new Set(Array.from({ length: 50 }, createInviteToken));

  expect(tokens.size).toBe(50);
  for (const token of tokens) expect(isInviteToken(token)).toBe(true);
});

test.each(["", "short", "a".repeat(25), "../../etc/passwd/aaaaaaa", "aaaaaaaaaaaaaaaaaaaaaa=="])("rejects %j", (value) => {
  expect(isInviteToken(value)).toBe(false);
});
```

`packages/db/src/invites.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  addFriendResponse,
  countFriendResponses,
  createTestDb,
  getInviteByToken,
  getInviteForResult,
  getOrCreateInvite,
  listFriendAnswers,
  seedUserWithResult,
  type Database,
} from "./testing";

let db: Database;
let resultId: string;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ userId, resultId } = await seedUserWithResult(db, { externalId: "owner", displayName: "Аня Петрова", gender: "female" }));
});

describe("invites", () => {
  test("a result has exactly one invite link", async () => {
    expect(await getInviteForResult(db, resultId)).toBeNull();

    const first = await getOrCreateInvite(db, resultId);
    const second = await getOrCreateInvite(db, resultId);

    expect(second).toEqual(first);
    expect(await getInviteForResult(db, resultId)).toEqual(first);
  });

  test("resolves a token to the owner and their answers", async () => {
    const { token } = await getOrCreateInvite(db, resultId);

    const context = await getInviteByToken(db, token);

    expect(context?.owner).toEqual({ id: userId, displayName: "Аня Петрова", gender: "female" });
    expect(context?.resultId).toBe(resultId);
    expect(context?.ownerAnswers["ipip-01"]).toBe(3);
  });

  test("returns null for unknown or malformed tokens", async () => {
    expect(await getInviteByToken(db, "x".repeat(24))).toBeNull();
    expect(await getInviteByToken(db, "bad")).toBeNull();
  });
});

describe("friend responses", () => {
  test("accepts one response per device and counts them", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, resultId);

    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 5 }, deviceHash: "d1" })).toBe("added");
    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 1 }, deviceHash: "d1" })).toBe("duplicate");
    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 2 }, deviceHash: "d2" })).toBe("added");

    expect(await countFriendResponses(db, inviteId)).toBe(2);
    expect(await listFriendAnswers(db, inviteId)).toEqual(expect.arrayContaining([{ "ipip-01": 5 }, { "ipip-01": 2 }]));
  });
});
```

`packages/db/src/pairs.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  acceptPairInvite,
  createTestDb,
  getOrCreatePairInvite,
  getPairForMember,
  getPairInviteByToken,
  leavePair,
  listActivePairs,
  seedUserWithResult,
  type Database,
} from "./testing";

const CONSENT_AT = new Date("2026-09-17T12:00:00Z");

let db: Database;
let anna: { userId: string; resultId: string };
let boris: { userId: string; resultId: string };
let vera: { userId: string; resultId: string };

async function invite(from = anna) {
  return getOrCreatePairInvite(db, { userId: from.userId, resultId: from.resultId });
}

async function accept(token: string, by = boris) {
  return acceptPairInvite(db, { token, partnerUserId: by.userId, partnerResultId: by.resultId, consentAt: CONSENT_AT });
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUserWithResult(db, { externalId: "anna", displayName: "Аня", gender: "female" });
  boris = await seedUserWithResult(db, { externalId: "boris", displayName: "Борис", gender: "male" });
  vera = await seedUserWithResult(db, { externalId: "vera", displayName: "Вера" });
});

describe("pair invites", () => {
  test("a result has one open invite until it is accepted", async () => {
    const first = await invite();
    expect(await invite()).toEqual(first);

    await accept(first.token);

    expect((await invite()).token).not.toBe(first.token);
  });

  test("resolves a token to the inviter and status", async () => {
    const { token } = await invite();

    expect(await getPairInviteByToken(db, token)).toMatchObject({ status: "open", inviter: { displayName: "Аня" }, inviterResultId: anna.resultId });
    expect(await getPairInviteByToken(db, "nope")).toBeNull();
  });
});

describe("acceptPairInvite", () => {
  test("creates a pair with both results", async () => {
    const { token } = await invite();

    const outcome = await accept(token);

    const pair = outcome.ok ? await getPairForMember(db, outcome.pairId, boris.userId) : null;
    expect(pair?.members.map((member) => member.user.displayName)).toEqual(["Аня", "Борис"]);
    expect(pair?.members[1].result.id).toBe(boris.resultId);
  });

  test("the inviter cannot accept their own invite", async () => {
    const { token } = await invite();

    expect(await accept(token, anna)).toEqual({ ok: false, reason: "own_invite" });
  });

  test("a link works only once", async () => {
    const { token } = await invite();
    await accept(token);

    expect(await accept(token, vera)).toEqual({ ok: false, reason: "already_used" });
  });

  test("two people have at most one active pair", async () => {
    await accept((await invite()).token);

    expect(await accept((await invite(boris)).token, anna)).toEqual({ ok: false, reason: "already_paired" });
  });

  test("reports an unknown token", async () => {
    expect(await accept("y".repeat(24))).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("membership and leaving", () => {
  test("only members see a pair, and nobody sees it after one leaves", async () => {
    const outcome = await accept((await invite()).token);
    const pairId = outcome.ok ? outcome.pairId : "";

    expect(await getPairForMember(db, pairId, vera.userId)).toBeNull();
    expect(await listActivePairs(db, anna.userId)).toEqual([expect.objectContaining({ id: pairId, partner: expect.objectContaining({ displayName: "Борис" }) })]);

    expect(await leavePair(db, pairId, vera.userId)).toBe(false);
    expect(await leavePair(db, pairId, boris.userId)).toBe(true);

    expect(await getPairForMember(db, pairId, anna.userId)).toBeNull();
    expect(await getPairForMember(db, pairId, boris.userId)).toBeNull();
    expect(await listActivePairs(db, anna.userId)).toEqual([]);
  });

  test("after leaving, the same people can pair again", async () => {
    const first = await accept((await invite()).token);
    await leavePair(db, first.ok ? first.pairId : "", anna.userId);

    expect((await accept((await invite()).token)).ok).toBe(true);
  });
});
```

`packages/db/src/notify-targets.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  addFriendResponse,
  createTestDb,
  getFriendAnsweredNotice,
  getNotifyTargets,
  getOrCreateInvite,
  seedUserWithResult,
  setCanNotify,
  type Database,
} from "./testing";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("notify targets", () => {
  test("telegram logins can be notified right away, vk only after permission", async () => {
    const tg = await seedUserWithResult(db, { externalId: "111", provider: "telegram" });
    const vk = await seedUserWithResult(db, { externalId: "222", provider: "vk" });

    expect(await getNotifyTargets(db, tg.userId)).toEqual([{ provider: "telegram", externalId: "111" }]);
    expect(await getNotifyTargets(db, vk.userId)).toEqual([]);

    await setCanNotify(db, { provider: "vk", externalId: "222", canNotify: true });
    await setCanNotify(db, { provider: "telegram", externalId: "111", canNotify: false });

    expect(await getNotifyTargets(db, vk.userId)).toEqual([{ provider: "vk", externalId: "222" }]);
    expect(await getNotifyTargets(db, tg.userId)).toEqual([]);
  });
});

describe("getFriendAnsweredNotice", () => {
  test("returns the owner, result and current count", async () => {
    const owner = await seedUserWithResult(db, { externalId: "owner" });
    const { id: inviteId } = await getOrCreateInvite(db, owner.resultId);
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "a" });
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "b" });

    expect(await getFriendAnsweredNotice(db, inviteId)).toEqual({ ownerUserId: owner.userId, resultId: owner.resultId, friendsCount: 2 });
    expect(await getFriendAnsweredNotice(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
```

```bash
pnpm vitest run packages/db
```
Expected: FAIL — нет модулей `./tokens`, `./invites`, `./pairs`, `./notify-targets`.

- [ ] **Step 4: Реализация**

`packages/db/src/tokens.ts`:
```ts
import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 18;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function createInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isInviteToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
```

`packages/db/src/invites.ts`:
```ts
import type { Answers } from "@grani/core";
import { count, eq } from "drizzle-orm";
import { friendResponses, invites, results } from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import type { Database } from "./types";
import { getUser, type UserRecord } from "./users";
import { isUuid } from "./uuid";

export type InviteRecord = { id: string; token: string };
export type InviteContext = { id: string; resultId: string; owner: UserRecord; ownerAnswers: Answers };
export type FriendResponseOutcome = "added" | "duplicate";

export async function getInviteForResult(db: Database, resultId: string): Promise<InviteRecord | null> {
  if (!isUuid(resultId)) return null;
  const [row] = await db.select({ id: invites.id, token: invites.token }).from(invites).where(eq(invites.resultId, resultId)).limit(1);
  return row ?? null;
}

export async function getOrCreateInvite(db: Database, resultId: string): Promise<InviteRecord> {
  // Уникальность result_id делает одновременные запросы безопасными: второй просто прочитает первую ссылку
  await db.insert(invites).values({ resultId, token: createInviteToken() }).onConflictDoNothing({ target: invites.resultId });
  const invite = await getInviteForResult(db, resultId);
  if (!invite) throw new Error(`Invite for result ${resultId} was not created`);
  return invite;
}

export async function getInviteByToken(db: Database, token: string): Promise<InviteContext | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await db
    .select({ id: invites.id, resultId: invites.resultId, userId: results.userId, answers: results.answers })
    .from(invites)
    .innerJoin(results, eq(results.id, invites.resultId))
    .where(eq(invites.token, token))
    .limit(1);
  if (!row) return null;
  const owner = await getUser(db, row.userId);
  return owner ? { id: row.id, resultId: row.resultId, owner, ownerAnswers: row.answers as Answers } : null;
}

export async function addFriendResponse(
  db: Database,
  p: { inviteId: string; answers: Answers; deviceHash: string },
): Promise<FriendResponseOutcome> {
  const inserted = await db
    .insert(friendResponses)
    .values(p)
    .onConflictDoNothing({ target: [friendResponses.inviteId, friendResponses.deviceHash] })
    .returning({ id: friendResponses.id });
  return inserted.length > 0 ? "added" : "duplicate";
}

// Отдельные ответы нужны только для подсчёта среднего; наружу из сервиса они не выходят
export async function listFriendAnswers(db: Database, inviteId: string): Promise<Answers[]> {
  const rows = await db.select({ answers: friendResponses.answers }).from(friendResponses).where(eq(friendResponses.inviteId, inviteId));
  return rows.map((row) => row.answers as Answers);
}

export async function countFriendResponses(db: Database, inviteId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(friendResponses).where(eq(friendResponses.inviteId, inviteId));
  return row?.value ?? 0;
}
```

`packages/db/src/pairs.ts`:
```ts
import type { Stability, TraitScores, TypeCode } from "@grani/core";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { type Database } from "./types";
import { pairInvites, pairs, results } from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import { getUser, type UserRecord } from "./users";
import { isUuid } from "./uuid";
import type { InviteRecord } from "./invites";

export type PairInviteContext = { id: string; token: string; status: "open" | "accepted"; inviter: UserRecord; inviterResultId: string };
export type PairResult = { id: string; scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type PairMember = { user: UserRecord; result: PairResult };
export type PairRecord = { id: string; createdAt: Date; members: readonly [PairMember, PairMember] };
export type AcceptOutcome = { ok: true; pairId: string } | { ok: false; reason: "not_found" | "own_invite" | "already_used" | "already_paired" };
export type ActivePair = { id: string; partner: UserRecord; createdAt: Date };

export async function getOrCreatePairInvite(db: Database, p: { userId: string; resultId: string }): Promise<InviteRecord> {
  const [open] = await db
    .select({ id: pairInvites.id, token: pairInvites.token })
    .from(pairInvites)
    .where(and(eq(pairInvites.inviterResultId, p.resultId), eq(pairInvites.inviterUserId, p.userId), eq(pairInvites.status, "open")))
    .limit(1);
  if (open) return open;
  const [created] = await db
    .insert(pairInvites)
    .values({ token: createInviteToken(), inviterUserId: p.userId, inviterResultId: p.resultId })
    .returning({ id: pairInvites.id, token: pairInvites.token });
  return created!;
}

export async function getPairInviteByToken(db: Database, token: string): Promise<PairInviteContext | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await db.select().from(pairInvites).where(eq(pairInvites.token, token)).limit(1);
  if (!row) return null;
  const inviter = await getUser(db, row.inviterUserId);
  return inviter ? { id: row.id, token: row.token, status: row.status, inviter, inviterResultId: row.inviterResultId } : null;
}

const activeBetween = (a: string, b: string) =>
  and(
    isNull(pairs.leftAt),
    or(and(eq(pairs.userAId, a), eq(pairs.userBId, b)), and(eq(pairs.userAId, b), eq(pairs.userBId, a))),
  );

export async function acceptPairInvite(
  db: Database,
  p: { token: string; partnerUserId: string; partnerResultId: string; consentAt: Date },
): Promise<AcceptOutcome> {
  const invite = await getPairInviteByToken(db, p.token);
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.inviter.id === p.partnerUserId) return { ok: false, reason: "own_invite" };
  if (invite.status !== "open") return { ok: false, reason: "already_used" };

  return db.transaction(async (tx): Promise<AcceptOutcome> => {
    const [existing] = await tx.select({ id: pairs.id }).from(pairs).where(activeBetween(invite.inviter.id, p.partnerUserId)).limit(1);
    if (existing) return { ok: false, reason: "already_paired" };
    // Условный UPDATE — единственная точка, где ссылка «сгорает»: второй одновременный запрос ничего не обновит
    const claimed = await tx
      .update(pairInvites)
      .set({ status: "accepted" })
      .where(and(eq(pairInvites.id, invite.id), eq(pairInvites.status, "open")))
      .returning({ id: pairInvites.id });
    if (claimed.length === 0) return { ok: false, reason: "already_used" };
    const [pair] = await tx
      .insert(pairs)
      .values({
        inviteId: invite.id,
        userAId: invite.inviter.id,
        resultAId: invite.inviterResultId,
        userBId: p.partnerUserId,
        resultBId: p.partnerResultId,
        partnerConsentAt: p.consentAt,
      })
      .returning({ id: pairs.id });
    return { ok: true, pairId: pair!.id };
  });
}

async function loadResult(db: Database, resultId: string): Promise<PairResult | null> {
  const [row] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  if (!row) return null;
  return { id: row.id, scores: row.scores as TraitScores, typeCode: row.typeCode as TypeCode, stability: row.stability as Stability };
}

async function loadMember(db: Database, userId: string, resultId: string): Promise<PairMember | null> {
  const [user, result] = await Promise.all([getUser(db, userId), loadResult(db, resultId)]);
  return user && result ? { user, result } : null;
}

export async function getPairForMember(db: Database, pairId: string, userId: string): Promise<PairRecord | null> {
  if (!isUuid(pairId) || !isUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(pairs)
    .where(and(eq(pairs.id, pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .limit(1);
  if (!row) return null;
  const [a, b] = await Promise.all([loadMember(db, row.userAId, row.resultAId), loadMember(db, row.userBId, row.resultBId)]);
  return a && b ? { id: row.id, createdAt: row.createdAt, members: [a, b] } : null;
}

export async function leavePair(db: Database, pairId: string, userId: string): Promise<boolean> {
  if (!isUuid(pairId) || !isUuid(userId)) return false;
  const updated = await db
    .update(pairs)
    .set({ leftAt: new Date() })
    .where(and(eq(pairs.id, pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .returning({ id: pairs.id });
  return updated.length > 0;
}

export async function listActivePairs(db: Database, userId: string): Promise<ActivePair[]> {
  if (!isUuid(userId)) return [];
  const rows = await db
    .select({ id: pairs.id, userAId: pairs.userAId, userBId: pairs.userBId, createdAt: pairs.createdAt })
    .from(pairs)
    .where(and(isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .orderBy(desc(pairs.createdAt));
  const withPartners = await Promise.all(
    rows.map(async (row) => {
      const partner = await getUser(db, row.userAId === userId ? row.userBId : row.userAId);
      return partner ? { id: row.id, partner, createdAt: row.createdAt } : null;
    }),
  );
  return withPartners.filter((pair): pair is ActivePair => pair !== null);
}
```

`packages/db/src/notify-targets.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { countFriendResponses } from "./invites";
import { authIdentities, invites, results, type AuthProvider } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type NotifyTarget = { provider: AuthProvider; externalId: string };

export async function getNotifyTargets(db: Database, userId: string): Promise<NotifyTarget[]> {
  if (!isUuid(userId)) return [];
  return db
    .select({ provider: authIdentities.provider, externalId: authIdentities.externalId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.canNotify, true)));
}

export async function setCanNotify(db: Database, p: NotifyTarget & { canNotify: boolean }): Promise<void> {
  await db
    .update(authIdentities)
    .set({ canNotify: p.canNotify })
    .where(and(eq(authIdentities.provider, p.provider), eq(authIdentities.externalId, p.externalId)));
}

export async function getFriendAnsweredNotice(
  db: Database,
  inviteId: string,
): Promise<{ ownerUserId: string; resultId: string; friendsCount: number } | null> {
  if (!isUuid(inviteId)) return null;
  const [row] = await db
    .select({ ownerUserId: results.userId, resultId: results.id })
    .from(invites)
    .innerJoin(results, eq(results.id, invites.resultId))
    .where(eq(invites.id, inviteId))
    .limit(1);
  return row ? { ...row, friendsCount: await countFriendResponses(db, inviteId) } : null;
}
```

В `packages/db/src/users.ts` при создании идентичности (вставка в `authIdentities` внутри транзакции нового пользователя) добавить поле:
```ts
      // Telegram-виджет запрашивает право писать (request-access=write); ВКонтакте разрешает сообщения отдельно
      canNotify: identity.provider === "telegram",
```

В `packages/db/src/users.test.ts` в `describe("upsertUserFromIdentity")` добавить:
```ts
  test("a new telegram identity can be notified, a new vk identity cannot", async () => {
    const tg = await upsertUserFromIdentity(db, identity(), CONSENT);
    const vk = await upsertUserFromIdentity(db, identity({ provider: "vk", externalId: "vk-1" }), CONSENT);

    const rows = await db.select({ provider: authIdentities.provider, canNotify: authIdentities.canNotify }).from(authIdentities);

    expect(tg.ok && vk.ok).toBe(true);
    expect(rows).toEqual(expect.arrayContaining([{ provider: "telegram", canNotify: true }, { provider: "vk", canNotify: false }]));
  });
```
и `authIdentities` в импорт из `./testing`.

`packages/db/src/index.ts` — добавить:
```ts
export * from "./tokens";
export * from "./invites";
export * from "./pairs";
export * from "./notify-targets";
```

- [ ] **Step 5: Запуск — тесты проходят**

```bash
pnpm vitest run packages/db && pnpm typecheck
```
Expected: все тесты `packages/db` зелёные, typecheck без ошибок.

- [ ] **Step 6: Коммит**

```bash
git add packages/db
git commit -m "feat(db): friend invites and responses, pair invites and pairs, notification permission"
```
