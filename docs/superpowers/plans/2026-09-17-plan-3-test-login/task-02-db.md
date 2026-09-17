# Task 2: `@grani/db` — схема, миграции, пользователи и результаты

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`, `client.ts`, `types.ts`, `testing.ts`, `index.ts`, `users.ts`, `results.ts`
- Create: `packages/db/scripts/migrate.mjs`, `packages/db/scripts/dev-db.mjs`
- Create (генерируется): `packages/db/drizzle/0000_*.sql`, `packages/db/drizzle/meta/*`
- Test: `packages/db/src/users.test.ts`, `packages/db/src/results.test.ts`
- Modify: `.gitignore`, `package.json` (скрипт `dev:db`), `vitest.config.ts` (покрытие)

**Interfaces:**
- Consumes: `Answers`, `TraitScores`, `TypeCode`, `Stability`, `Gender` из `@grani/core`.
- Produces:
  ```ts
  type Database; // PgDatabase<PgQueryResultHKT, typeof schema>
  function createDb(databaseUrl: string, options?: { maxConnections?: number }): Database;
  // "@grani/db/testing"
  function createTestDb(): Promise<Database>;

  type AuthProvider = "telegram" | "vk";
  type KnownGender = Exclude<Gender, null>; // "female" | "male"
  type IdentityInput = { provider: AuthProvider; externalId: string; displayName: string; gender: KnownGender | null };
  type Consent = { version: string; at: Date };
  type UserRecord = { id: string; displayName: string; gender: KnownGender | null };
  type UpsertOutcome = { ok: true; user: UserRecord; created: boolean } | { ok: false; reason: "CONSENT_REQUIRED" };
  function upsertUserFromIdentity(db: Database, identity: IdentityInput, consent: Consent | null): Promise<UpsertOutcome>;
  function getUser(db: Database, userId: string): Promise<UserRecord | null>;

  type NewResult = { userId: string; answers: Answers; scores: TraitScores; typeCode: TypeCode; stability: Stability };
  type ResultRecord = NewResult & { id: string; createdAt: Date };
  function createResult(db: Database, input: NewResult): Promise<ResultRecord>;
  function getResultForOwner(db: Database, resultId: string, userId: string): Promise<ResultRecord | null>;
  function getLatestResultId(db: Database, userId: string): Promise<string | null>;
  ```

Схема — подмножество раздела 5.2 спецификации, нужное для этого плана: `users`, `auth_identities`, `results`. Таблицы приглашений, пар, покупок и разборов добавят планы 4 и 5 своими миграциями. Имя для показа хранится в `auth_identities.display_name` и обновляется при каждом входе. Пользователь без согласия в базу не попадает: `consent_version` и `consented_at` обязательны.

- [ ] **Step 1: Пакет**

`packages/db/package.json`:
```json
{
  "name": "@grani/db",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@grani/core": "workspace:*",
    "drizzle-orm": "0.45.2",
    "postgres": "3.4.9"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.5.8",
    "@electric-sql/pglite-socket": "0.2.11",
    "drizzle-kit": "0.31.10"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "drizzle.config.ts"]
}
```

`packages/db/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "db", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
});
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
```

В `.gitignore` добавить:
```
.dev-db/
test-results/
playwright-report/
.env.development.local
```

В корневой `package.json` в `scripts` добавить:
```json
    "dev:db": "node packages/db/scripts/dev-db.mjs"
```

В корневом `vitest.config.ts` в `coverage.include` добавить `"packages/db/src/**/*.ts"`, в `coverage.exclude` — `"**/testing.ts"`, `"**/client.ts"`.

- [ ] **Step 2: Схема**

`packages/db/src/schema.ts`:
```ts
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", ["telegram", "vk"]);
export const genderEnum = pgEnum("gender", ["female", "male"]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  gender: genderEnum("gender"),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_external_uq").on(t.provider, t.externalId),
    uniqueIndex("auth_identities_user_provider_uq").on(t.userId, t.provider),
  ],
);

export const results = pgTable(
  "results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull(),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    typeCode: text("type_code").notNull(),
    stability: text("stability").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("results_user_created_idx").on(t.userId, t.createdAt)],
);
```

`packages/db/src/types.ts`:
```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
```

`packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

const DEFAULT_MAX_CONNECTIONS = 5;

export function createDb(databaseUrl: string, options: { maxConnections?: number } = {}): Database {
  const client = postgres(databaseUrl, { max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  return drizzle(client, { schema }) as unknown as Database;
}
```

- [ ] **Step 3: Миграция и помощники**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install
pnpm --filter @grani/db db:generate
```
Expected: создан `packages/db/drizzle/0000_<имя>.sql` с `CREATE TYPE "public"."auth_provider"`, `"gender"` и тремя таблицами.

`packages/db/src/testing.ts`:
```ts
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Database } from "./types";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Database;
}

export * from "./index";
```

`packages/db/scripts/migrate.mjs` — перенести из `C:\dev\wishlist\packages\db\scripts\migrate.mjs` без изменений (читает `DATABASE_URL`, применяет миграции из `../drizzle`).

`packages/db/scripts/dev-db.mjs` — перенести из `C:\dev\wishlist\packages\db\scripts\dev-db.mjs` без изменений логики: PGlite с данными в `.dev-db/` в корне репозитория, миграции, сокет-сервер на `127.0.0.1:5433`, `maxConnections: 10`, обработка `ECONNRESET`/`EPIPE` и `SIGINT`.

- [ ] **Step 4: Тесты (падают)**

`packages/db/src/users.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, getUser, upsertUserFromIdentity, type Database, type IdentityInput } from "./testing";

const CONSENT = { version: "2026-09-v1", at: new Date("2026-09-17T10:00:00Z") };

function identity(overrides: Partial<IdentityInput> = {}): IdentityInput {
  return { provider: "telegram", externalId: "1001", displayName: "Аня", gender: null, ...overrides };
}

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("upsertUserFromIdentity", () => {
  test("refuses to create a user without consent", async () => {
    const outcome = await upsertUserFromIdentity(db, identity(), null);

    expect(outcome).toEqual({ ok: false, reason: "CONSENT_REQUIRED" });
  });

  test("creates a user with consent and returns the display name", async () => {
    const outcome = await upsertUserFromIdentity(db, identity({ gender: "female" }), CONSENT);

    expect(outcome.ok && outcome.created).toBe(true);
    expect(outcome.ok && outcome.user).toMatchObject({ displayName: "Аня", gender: "female" });
  });

  test("finds the existing user on the next login even without a new consent", async () => {
    const first = await upsertUserFromIdentity(db, identity(), CONSENT);

    const second = await upsertUserFromIdentity(db, identity({ displayName: "Анна" }), null);

    expect(second.ok && second.created).toBe(false);
    expect(second.ok && second.user.id).toBe(first.ok && first.user.id);
    expect(second.ok && second.user.displayName).toBe("Анна");
  });

  test("fills a missing gender but never overwrites a known one", async () => {
    const created = await upsertUserFromIdentity(db, identity(), CONSENT);
    const userId = created.ok ? created.user.id : "";

    await upsertUserFromIdentity(db, identity({ gender: "female" }), null);
    await upsertUserFromIdentity(db, identity({ gender: "male" }), null);

    expect((await getUser(db, userId))?.gender).toBe("female");
  });

  test("treats the same external id from another provider as another user", async () => {
    const telegram = await upsertUserFromIdentity(db, identity(), CONSENT);

    const vk = await upsertUserFromIdentity(db, identity({ provider: "vk" }), CONSENT);

    expect(vk.ok && vk.user.id).not.toBe(telegram.ok && telegram.user.id);
  });
});

describe("getUser", () => {
  test("returns null for an unknown or malformed id", async () => {
    expect(await getUser(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getUser(db, "not-a-uuid")).toBeNull();
  });
});
```

`packages/db/src/results.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  createResult,
  createTestDb,
  getLatestResultId,
  getResultForOwner,
  upsertUserFromIdentity,
  type Database,
  type NewResult,
} from "./testing";

const CONSENT = { version: "2026-09-v1", at: new Date("2026-09-17T10:00:00Z") };
const SCORES = { openness: 70, conscientiousness: 40, extraversion: 65, agreeableness: 80, stability: 55 };

let db: Database;
let ownerId: string;
let strangerId: string;

async function createUser(externalId: string): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: "telegram", externalId, displayName: externalId, gender: null },
    CONSENT,
  );
  if (!outcome.ok) throw new Error("user was not created");
  return outcome.user.id;
}

function newResult(userId: string): NewResult {
  return { userId, answers: { "ipip-01": 5, "ipip-02": 1 }, scores: SCORES, typeCode: "+-++", stability: "calm" };
}

beforeEach(async () => {
  db = await createTestDb();
  ownerId = await createUser("owner");
  strangerId = await createUser("stranger");
});

describe("results", () => {
  test("stores a result and reads it back for its owner", async () => {
    const created = await createResult(db, newResult(ownerId));

    const read = await getResultForOwner(db, created.id, ownerId);

    expect(read).toMatchObject({ id: created.id, userId: ownerId, scores: SCORES, typeCode: "+-++", stability: "calm" });
    expect(read?.createdAt).toBeInstanceOf(Date);
  });

  test("hides a result from other users", async () => {
    const created = await createResult(db, newResult(ownerId));

    expect(await getResultForOwner(db, created.id, strangerId)).toBeNull();
  });

  test("returns null for a malformed result id instead of failing", async () => {
    expect(await getResultForOwner(db, "../../etc", ownerId)).toBeNull();
  });

  test("finds the latest result of a user", async () => {
    expect(await getLatestResultId(db, ownerId)).toBeNull();
    await createResult(db, newResult(ownerId));
    await new Promise((resolve) => setTimeout(resolve, 5)); // разные created_at у двух вставок
    const latest = await createResult(db, { ...newResult(ownerId), typeCode: "----" });

    expect(await getLatestResultId(db, ownerId)).toBe(latest.id);
  });
});
```

```bash
pnpm vitest run packages/db
```
Expected: FAIL — `Failed to resolve import "./users"` / `"./results"` (экспорты в `index.ts` ещё не созданы).

- [ ] **Step 5: Реализация**

`packages/db/src/users.ts`:
```ts
import type { Gender } from "@grani/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import { authIdentities, type AuthProvider, users } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type KnownGender = Exclude<Gender, null>;
export type IdentityInput = { provider: AuthProvider; externalId: string; displayName: string; gender: KnownGender | null };
export type Consent = { version: string; at: Date };
export type UserRecord = { id: string; displayName: string; gender: KnownGender | null };
export type UpsertOutcome = { ok: true; user: UserRecord; created: boolean } | { ok: false; reason: "CONSENT_REQUIRED" };

async function findOwner(db: Database, provider: AuthProvider, externalId: string) {
  const [row] = await db
    .select({ userId: authIdentities.userId, gender: users.gender })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.externalId, externalId), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function upsertUserFromIdentity(
  db: Database,
  identity: IdentityInput,
  consent: Consent | null,
): Promise<UpsertOutcome> {
  const owner = await findOwner(db, identity.provider, identity.externalId);
  if (owner) {
    const gender = owner.gender ?? identity.gender;
    await db.transaction(async (tx) => {
      await tx
        .update(authIdentities)
        .set({ displayName: identity.displayName })
        .where(and(eq(authIdentities.provider, identity.provider), eq(authIdentities.externalId, identity.externalId)));
      if (gender !== owner.gender) await tx.update(users).set({ gender }).where(eq(users.id, owner.userId));
      if (consent) {
        await tx
          .update(users)
          .set({ consentVersion: consent.version, consentedAt: consent.at })
          .where(eq(users.id, owner.userId));
      }
    });
    return { ok: true, created: false, user: { id: owner.userId, displayName: identity.displayName, gender } };
  }
  if (!consent) return { ok: false, reason: "CONSENT_REQUIRED" };
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ gender: identity.gender, consentVersion: consent.version, consentedAt: consent.at })
      .returning({ id: users.id });
    await tx.insert(authIdentities).values({
      userId: created!.id,
      provider: identity.provider,
      externalId: identity.externalId,
      displayName: identity.displayName,
    });
    return created!;
  });
  return { ok: true, created: true, user: { id: user.id, displayName: identity.displayName, gender: identity.gender } };
}

export async function getUser(db: Database, userId: string): Promise<UserRecord | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({ id: users.id, gender: users.gender, displayName: authIdentities.displayName })
    .from(users)
    .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .orderBy(asc(authIdentities.createdAt))
    .limit(1);
  return row ?? null;
}
```

`packages/db/src/uuid.ts`:
```ts
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
```

`packages/db/src/results.ts`:
```ts
import type { Answers, Stability, TraitScores, TypeCode } from "@grani/core";
import { and, desc, eq } from "drizzle-orm";
import { results } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type NewResult = { userId: string; answers: Answers; scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type ResultRecord = NewResult & { id: string; createdAt: Date };

type ResultRow = typeof results.$inferSelect;

// В базе jsonb и text; значения туда попадают только через createResult, поэтому приведение типов безопасно
function toRecord(row: ResultRow): ResultRecord {
  return {
    id: row.id,
    userId: row.userId,
    answers: row.answers as Answers,
    scores: row.scores as TraitScores,
    typeCode: row.typeCode as TypeCode,
    stability: row.stability as Stability,
    createdAt: row.createdAt,
  };
}

export async function createResult(db: Database, input: NewResult): Promise<ResultRecord> {
  const [row] = await db.insert(results).values(input).returning();
  return toRecord(row!);
}

export async function getResultForOwner(db: Database, resultId: string, userId: string): Promise<ResultRecord | null> {
  if (!isUuid(resultId) || !isUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(results)
    .where(and(eq(results.id, resultId), eq(results.userId, userId)))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function getLatestResultId(db: Database, userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db
    .select({ id: results.id })
    .from(results)
    .where(eq(results.userId, userId))
    .orderBy(desc(results.createdAt))
    .limit(1);
  return row?.id ?? null;
}
```

`packages/db/src/index.ts`:
```ts
export * from "./schema";
export * from "./types";
export * from "./client";
export * from "./users";
export * from "./results";
```

- [ ] **Step 6: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные (планы 1–2 + `users.test.ts` + `results.test.ts`), typecheck без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add .gitignore package.json vitest.config.ts pnpm-lock.yaml packages/db
git commit -m "feat(db): users with consent, auth identities and test results"
```
