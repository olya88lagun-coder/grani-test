# Task 2: Таблицы `purchases` и `reports`, репозитории покупок и разборов

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/results.ts`, `packages/db/src/results.test.ts`, `packages/db/src/testing.ts`, `packages/db/src/index.ts`
- Create (генерируется): `packages/db/drizzle/0002_*.sql`, `packages/db/drizzle/meta/*`
- Create: `packages/db/src/reports.ts`, `packages/db/src/reports.test.ts`, `packages/db/src/purchases.ts`, `packages/db/src/purchases.test.ts`

**Interfaces:**
- Consumes: `Product`, `PRODUCT_PRICES`, `REPORT_KINDS`, `ReportKind` (`@grani/core`, Task 1); `results`, `pairs`, `users`, `isUuid`, `getOrCreatePairInvite`, `acceptPairInvite`, `seedUserWithResult` (планы 3–4).
- Produces:
  ```ts
  // reports.ts
  type ReportTarget = { resultId: string } | { pairId: string };
  type ReportSource = "ai" | "fallback";
  type ReportRecord = { id: string; resultId: string | null; pairId: string | null; kind: ReportKind; sections: unknown; source: ReportSource; createdAt: Date };
  function saveReport(db: Database, p: { target: ReportTarget; kind: ReportKind; sections: unknown; source: ReportSource }): Promise<{ report: ReportRecord; created: boolean }>;
  function getReport(db: Database, target: ReportTarget, kind: ReportKind): Promise<ReportRecord | null>;
  function getReportById(db: Database, reportId: string): Promise<ReportRecord | null>;
  function listReports(db: Database, target: ReportTarget): Promise<ReportRecord[]>;

  // purchases.ts
  type PurchaseStatus = "pending" | "succeeded" | "canceled" | "refunded";
  type PurchaseRecord = {
    id: string; userId: string; product: Product; resultId: string | null; pairId: string | null;
    amountKopecks: number; status: PurchaseStatus; yookassaPaymentId: string | null; confirmationUrl: string | null;
    createdAt: Date; paidAt: Date | null;
  };
  function createPurchase(db: Database, p: { userId: string; product: Product; target: ReportTarget; amountKopecks: number }): Promise<PurchaseRecord>;
  function attachPayment(db: Database, purchaseId: string, p: { paymentId: string; confirmationUrl: string }): Promise<void>;
  function getPurchase(db: Database, purchaseId: string): Promise<PurchaseRecord | null>;
  function getPurchaseByPaymentId(db: Database, paymentId: string): Promise<PurchaseRecord | null>;
  function findOpenPurchase(db: Database, p: { userId: string; product: Product; target: ReportTarget; since: Date }): Promise<PurchaseRecord | null>;
  function markPurchaseSucceeded(db: Database, purchaseId: string, paidAt: Date): Promise<boolean>;
  function markPurchaseCanceled(db: Database, purchaseId: string): Promise<boolean>;
  function listOwnedProducts(db: Database, target: ReportTarget): Promise<Product[]>;

  // results.ts
  function getResult(db: Database, resultId: string): Promise<ResultRecord | null>; // без проверки владельца — для воркера

  // testing.ts
  function seedPair(db: Database, p?: { scoresA?: TraitScores; scoresB?: TraitScores }): Promise<{ pairId: string; a: { userId: string; resultId: string }; b: { userId: string; resultId: string } }>;
  ```

Раздел 5.2 спецификации. Покупка и разбор принадлежат ровно одному из двух — результату или паре. У разборов это ограничение в базе (`num_nonnulls(...) = 1`). У покупок в базе стоит только `<= 1`: записи об оплатах хранятся для налогового учёта и после удаления данных, когда результат или пара исчезнут и ссылка станет `NULL` (план 6). Ровно одну цель при создании покупки гарантирует тип `ReportTarget`.

Идемпотентность генерации держит база: частичные уникальные индексы `(result_id, kind)` и `(pair_id, kind)`. `saveReport` вставляет с `ON CONFLICT DO NOTHING` и возвращает уже существующий разбор с `created: false`.

- [ ] **Step 1: Схема и миграция**

В `packages/db/src/schema.ts`: в импорт `drizzle-orm/pg-core` добавить `integer`; в начало файла — импорт `import { REPORT_KINDS } from "@grani/core";`; в конец файла:
```ts
export const productEnum = pgEnum("product", [
  "full",
  "chapter_money",
  "chapter_conflict",
  "chapter_stress",
  "chapter_relationships",
  "chapters_all",
  "pair",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "succeeded", "canceled", "refunded"]);
export const reportKindEnum = pgEnum("report_kind", REPORT_KINDS);
export const reportSourceEnum = pgEnum("report_source", ["ai", "fallback"]);

export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type ReportSource = (typeof reportSourceEnum.enumValues)[number];

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    product: productEnum("product").notNull(),
    // Записи об оплатах переживают удаление данных (налоговый учёт), поэтому ссылка обнуляется, а не удаляет покупку
    resultId: uuid("result_id").references(() => results.id, { onDelete: "set null" }),
    pairId: uuid("pair_id").references(() => pairs.id, { onDelete: "set null" }),
    amountKopecks: integer("amount_kopecks").notNull(),
    status: purchaseStatusEnum("status").notNull().default("pending"),
    yookassaPaymentId: text("yookassa_payment_id").unique(),
    confirmationUrl: text("confirmation_url"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("purchases_result_idx").on(t.resultId),
    index("purchases_pair_idx").on(t.pairId),
    index("purchases_user_idx").on(t.userId, t.createdAt),
    check("purchases_at_most_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}) <= 1`),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id").references(() => results.id, { onDelete: "cascade" }),
    pairId: uuid("pair_id").references(() => pairs.id, { onDelete: "cascade" }),
    kind: reportKindEnum("kind").notNull(),
    sections: jsonb("sections").notNull(),
    source: reportSourceEnum("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reports_result_kind_uq").on(t.resultId, t.kind).where(sql`${t.resultId} is not null`),
    uniqueIndex("reports_pair_kind_uq").on(t.pairId, t.kind).where(sql`${t.pairId} is not null`),
    check("reports_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}) = 1`),
  ],
);
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm --filter @grani/db db:generate
```
Expected: `packages/db/drizzle/0002_<имя>.sql` с четырьмя `CREATE TYPE`, двумя `CREATE TABLE`, двумя частичными `CREATE UNIQUE INDEX ... WHERE`. Локальную базу `pnpm dev:db` после этого перезапустить (Ctrl+C, не принудительно): миграции применяются только при старте.

- [ ] **Step 2: Помощник для тестов**

В `packages/db/src/testing.ts` добавить импорт `import { acceptPairInvite, getOrCreatePairInvite } from "./pairs";` и функцию перед `export * from "./index";`:
```ts
const PAIR_B_SCORES = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

// Активная пара из двух новых пользователей — для тестов разбора пары
export async function seedPair(
  db: Database,
  p: { scoresA?: TraitScores; scoresB?: TraitScores } = {},
): Promise<{ pairId: string; a: { userId: string; resultId: string }; b: { userId: string; resultId: string } }> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const a = await seedUserWithResult(db, { externalId: `pair-a-${suffix}`, displayName: "Аня", scores: p.scoresA });
  const b = await seedUserWithResult(db, { externalId: `pair-b-${suffix}`, displayName: "Борис", scores: p.scoresB ?? PAIR_B_SCORES });
  const { token } = await getOrCreatePairInvite(db, a);
  const outcome = await acceptPairInvite(db, { token, partnerUserId: b.userId, partnerResultId: b.resultId, consentAt: new Date("2026-09-17T12:00:00Z") });
  if (!outcome.ok) throw new Error(`seed pair was not created: ${outcome.reason}`);
  return { pairId: outcome.pairId, a, b };
}
```

- [ ] **Step 3: Тесты (падают)**

`packages/db/src/reports.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, getReport, getReportById, listReports, saveReport, seedPair, seedUserWithResult, type Database } from "./testing";

let db: Database;
let resultId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ resultId } = await seedUserWithResult(db, { externalId: "anna" }));
});

describe("saveReport", () => {
  test("stores a report once per result and kind", async () => {
    const first = await saveReport(db, { target: { resultId }, kind: "full", sections: { portrait: "a" }, source: "ai" });
    const second = await saveReport(db, { target: { resultId }, kind: "full", sections: { portrait: "b" }, source: "fallback" });

    expect(first.created).toBe(true);
    expect(second).toEqual({ report: first.report, created: false });
    expect((await getReport(db, { resultId }, "full"))?.sections).toEqual({ portrait: "a" });
  });

  test("keeps different kinds apart and lists them", async () => {
    await saveReport(db, { target: { resultId }, kind: "full", sections: {}, source: "ai" });
    await saveReport(db, { target: { resultId }, kind: "chapter_money", sections: {}, source: "fallback" });

    expect((await listReports(db, { resultId })).map((report) => report.kind).sort()).toEqual(["chapter_money", "full"]);
    expect(await getReport(db, { resultId }, "friends")).toBeNull();
  });

  test("a pair report belongs to the pair", async () => {
    const { pairId } = await seedPair(db);

    const { report } = await saveReport(db, { target: { pairId }, kind: "pair", sections: { similar: "x" }, source: "ai" });

    expect(report).toMatchObject({ pairId, resultId: null, kind: "pair" });
    expect(await getReportById(db, report.id)).toEqual(report);
    expect(await getReportById(db, "not-a-uuid")).toBeNull();
    expect(await listReports(db, { pairId: "not-a-uuid" })).toEqual([]);
  });
});
```

`packages/db/src/purchases.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  attachPayment,
  createPurchase,
  createTestDb,
  findOpenPurchase,
  getPurchase,
  getPurchaseByPaymentId,
  listOwnedProducts,
  markPurchaseCanceled,
  markPurchaseSucceeded,
  seedPair,
  seedUserWithResult,
  type Database,
} from "./testing";

const PAID_AT = new Date("2026-09-22T10:00:00Z");

let db: Database;
let anna: { userId: string; resultId: string };

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUserWithResult(db, { externalId: "anna" });
});

const buyFull = () => createPurchase(db, { userId: anna.userId, product: "full", target: { resultId: anna.resultId }, amountKopecks: 29900 });

describe("purchases", () => {
  test("a new purchase is pending and learns its payment", async () => {
    const purchase = await buyFull();
    await attachPayment(db, purchase.id, { paymentId: "pay-1", confirmationUrl: "https://yoomoney.ru/checkout/1" });

    expect(purchase).toMatchObject({ status: "pending", product: "full", resultId: anna.resultId, pairId: null, amountKopecks: 29900, paidAt: null });
    expect(await getPurchaseByPaymentId(db, "pay-1")).toMatchObject({ id: purchase.id, confirmationUrl: "https://yoomoney.ru/checkout/1" });
    expect(await getPurchase(db, "not-a-uuid")).toBeNull();
  });

  test("succeeds only once and only from pending", async () => {
    const purchase = await buyFull();

    expect(await markPurchaseSucceeded(db, purchase.id, PAID_AT)).toBe(true);
    expect(await markPurchaseSucceeded(db, purchase.id, PAID_AT)).toBe(false);
    expect(await markPurchaseCanceled(db, purchase.id)).toBe(false);
    expect(await getPurchase(db, purchase.id)).toMatchObject({ status: "succeeded", paidAt: PAID_AT });
  });

  test("owned products are the succeeded ones of that target", async () => {
    const paid = await buyFull();
    const canceled = await createPurchase(db, { userId: anna.userId, product: "chapters_all", target: { resultId: anna.resultId }, amountKopecks: 24900 });
    await markPurchaseSucceeded(db, paid.id, PAID_AT);
    await markPurchaseCanceled(db, canceled.id);
    const { pairId } = await seedPair(db);

    expect(await listOwnedProducts(db, { resultId: anna.resultId })).toEqual(["full"]);
    expect(await listOwnedProducts(db, { pairId })).toEqual([]);
  });

  test("finds a recent pending purchase with a payment page to reuse", async () => {
    const purchase = await buyFull();
    const target = { resultId: anna.resultId };

    expect(await findOpenPurchase(db, { userId: anna.userId, product: "full", target, since: new Date(0) })).toBeNull();
    await attachPayment(db, purchase.id, { paymentId: "pay-2", confirmationUrl: "https://yoomoney.ru/checkout/2" });
    expect((await findOpenPurchase(db, { userId: anna.userId, product: "full", target, since: new Date(0) }))?.id).toBe(purchase.id);
    expect(await findOpenPurchase(db, { userId: anna.userId, product: "full", target, since: new Date(Date.now() + 60_000) })).toBeNull();
    expect(await findOpenPurchase(db, { userId: anna.userId, product: "chapter_money", target, since: new Date(0) })).toBeNull();
  });
});
```

В `packages/db/src/results.test.ts` дописать:
```ts
describe("getResult", () => {
  test("reads a result by id without an owner check", async () => {
    const { resultId } = await seedUserWithResult(db, { externalId: "worker-read" });

    expect((await getResult(db, resultId))?.id).toBe(resultId);
    expect(await getResult(db, "not-a-uuid")).toBeNull();
  });
});
```
с `getResult` и `seedUserWithResult` в импорте из `./testing` (если `db` в этом файле создаётся в `beforeEach` под другим именем — использовать его).

```bash
pnpm vitest run packages/db
```
Expected: FAIL — нет `./reports`, `./purchases`, `getResult`.

- [ ] **Step 4: Реализация**

`packages/db/src/reports.ts`:
```ts
import type { ReportKind } from "@grani/core";
import { and, eq } from "drizzle-orm";
import { reports, type ReportSource } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type { ReportSource } from "./schema";
export type ReportTarget = { resultId: string } | { pairId: string };
export type ReportRecord = {
  id: string;
  resultId: string | null;
  pairId: string | null;
  kind: ReportKind;
  sections: unknown;
  source: ReportSource;
  createdAt: Date;
};

type ReportRow = typeof reports.$inferSelect;

const toRecord = (row: ReportRow): ReportRecord => ({ ...row, kind: row.kind as ReportKind });

export function targetId(target: ReportTarget): string {
  return "resultId" in target ? target.resultId : target.pairId;
}

export function targetColumns(target: ReportTarget): { resultId: string | null; pairId: string | null } {
  return "resultId" in target ? { resultId: target.resultId, pairId: null } : { resultId: null, pairId: target.pairId };
}

function targetWhere(target: ReportTarget) {
  return "resultId" in target ? eq(reports.resultId, target.resultId) : eq(reports.pairId, target.pairId);
}

export async function getReport(db: Database, target: ReportTarget, kind: ReportKind): Promise<ReportRecord | null> {
  if (!isUuid(targetId(target))) return null;
  const [row] = await db.select().from(reports).where(and(targetWhere(target), eq(reports.kind, kind))).limit(1);
  return row ? toRecord(row) : null;
}

export async function saveReport(
  db: Database,
  p: { target: ReportTarget; kind: ReportKind; sections: unknown; source: ReportSource },
): Promise<{ report: ReportRecord; created: boolean }> {
  // Уникальный индекс (цель, вид) — единственная защита от второй генерации при повторе задачи
  const [inserted] = await db
    .insert(reports)
    .values({ ...targetColumns(p.target), kind: p.kind, sections: p.sections, source: p.source })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { report: toRecord(inserted), created: true };
  const existing = await getReport(db, p.target, p.kind);
  if (!existing) throw new Error("report conflict without an existing report");
  return { report: existing, created: false };
}

export async function getReportById(db: Database, reportId: string): Promise<ReportRecord | null> {
  if (!isUuid(reportId)) return null;
  const [row] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  return row ? toRecord(row) : null;
}

export async function listReports(db: Database, target: ReportTarget): Promise<ReportRecord[]> {
  if (!isUuid(targetId(target))) return [];
  return (await db.select().from(reports).where(targetWhere(target))).map(toRecord);
}
```

`packages/db/src/purchases.ts`:
```ts
import type { Product } from "@grani/core";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { targetColumns, targetId, type ReportTarget } from "./reports";
import { purchases, type PurchaseStatus } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type { PurchaseStatus } from "./schema";
export type PurchaseRecord = {
  id: string;
  userId: string;
  product: Product;
  resultId: string | null;
  pairId: string | null;
  amountKopecks: number;
  status: PurchaseStatus;
  yookassaPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

type PurchaseRow = typeof purchases.$inferSelect;

const toRecord = (row: PurchaseRow): PurchaseRecord => ({ ...row, product: row.product as Product });

function targetWhere(target: ReportTarget) {
  return "resultId" in target ? eq(purchases.resultId, target.resultId) : eq(purchases.pairId, target.pairId);
}

export async function createPurchase(
  db: Database,
  p: { userId: string; product: Product; target: ReportTarget; amountKopecks: number },
): Promise<PurchaseRecord> {
  const [row] = await db
    .insert(purchases)
    .values({ userId: p.userId, product: p.product, ...targetColumns(p.target), amountKopecks: p.amountKopecks })
    .returning();
  return toRecord(row!);
}

export async function attachPayment(db: Database, purchaseId: string, p: { paymentId: string; confirmationUrl: string }): Promise<void> {
  await db.update(purchases).set({ yookassaPaymentId: p.paymentId, confirmationUrl: p.confirmationUrl }).where(eq(purchases.id, purchaseId));
}

export async function getPurchase(db: Database, purchaseId: string): Promise<PurchaseRecord | null> {
  if (!isUuid(purchaseId)) return null;
  const [row] = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
  return row ? toRecord(row) : null;
}

export async function getPurchaseByPaymentId(db: Database, paymentId: string): Promise<PurchaseRecord | null> {
  const [row] = await db.select().from(purchases).where(eq(purchases.yookassaPaymentId, paymentId)).limit(1);
  return row ? toRecord(row) : null;
}

export async function findOpenPurchase(
  db: Database,
  p: { userId: string; product: Product; target: ReportTarget; since: Date },
): Promise<PurchaseRecord | null> {
  if (!isUuid(targetId(p.target))) return null;
  const [row] = await db
    .select()
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, p.userId),
        eq(purchases.product, p.product),
        targetWhere(p.target),
        eq(purchases.status, "pending"),
        isNotNull(purchases.confirmationUrl),
        gte(purchases.createdAt, p.since),
      ),
    )
    .orderBy(desc(purchases.createdAt))
    .limit(1);
  return row ? toRecord(row) : null;
}

// Условный UPDATE: из двух одновременных уведомлений переход сделает только одно — и только оно поставит генерацию
export async function markPurchaseSucceeded(db: Database, purchaseId: string, paidAt: Date): Promise<boolean> {
  const updated = await db
    .update(purchases)
    .set({ status: "succeeded", paidAt })
    .where(and(eq(purchases.id, purchaseId), eq(purchases.status, "pending")))
    .returning({ id: purchases.id });
  return updated.length > 0;
}

export async function markPurchaseCanceled(db: Database, purchaseId: string): Promise<boolean> {
  const updated = await db
    .update(purchases)
    .set({ status: "canceled" })
    .where(and(eq(purchases.id, purchaseId), eq(purchases.status, "pending")))
    .returning({ id: purchases.id });
  return updated.length > 0;
}

export async function listOwnedProducts(db: Database, target: ReportTarget): Promise<Product[]> {
  if (!isUuid(targetId(target))) return [];
  const rows = await db
    .select({ product: purchases.product })
    .from(purchases)
    .where(and(targetWhere(target), eq(purchases.status, "succeeded")));
  return rows.map((row) => row.product as Product);
}
```

В `packages/db/src/results.ts`:
```ts
export async function getResult(db: Database, resultId: string): Promise<ResultRecord | null> {
  if (!isUuid(resultId)) return null;
  const [row] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  return row ? toRecord(row) : null;
}
```

В `packages/db/src/index.ts` добавить `export * from "./reports";` и `export * from "./purchases";`.

- [ ] **Step 5: Запуск — тесты проходят**

```bash
pnpm vitest run packages/db && pnpm typecheck
```
Expected: всё зелёное.

- [ ] **Step 6: Коммит**

```bash
git add packages/db
git commit -m "feat(db): purchases and reports with one report per target and kind"
```
