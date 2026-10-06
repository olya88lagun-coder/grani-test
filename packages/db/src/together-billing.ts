import { canRenew, nextPeriod, TOGETHER_PRODUCT, unusedPaidMs, type AccessPeriod } from "@grani/core";
import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import { toPurchaseRecord, type PurchaseRecord } from "./purchases";
import { purchases, togetherAccessPeriods, togetherSpaces, type TogetherClosedReason } from "./schema";
import type { Database } from "./types";

const DAY_MS = 86_400_000;

export type GrantOutcome = { ok: true; created: boolean; period: AccessPeriod } | { ok: false; reason: "space_not_found" | "space_closed" };
export type ReserveOutcome = { kind: "reused" | "created"; purchase: PurchaseRecord } | { kind: "not_available" } | { kind: "busy" };
export type PaidWithoutAccess = { purchaseId: string; spaceId: string | null; userId: string; paidAt: Date | null; amountKopecks: number };
export type ClosedWithRemaining = { spaceId: string; closedAt: Date; closedReason: TogetherClosedReason | null; remainingDays: number };

type PeriodRow = typeof togetherAccessPeriods.$inferSelect;

const toPeriod = (row: Pick<PeriodRow, "startsAt" | "endsAt">): AccessPeriod => ({ startsAt: row.startsAt, endsAt: row.endsAt });

export async function listAccessPeriods(db: Database, spaceId: string): Promise<AccessPeriod[]> {
  const rows = await db.select().from(togetherAccessPeriods).where(eq(togetherAccessPeriods.spaceId, spaceId)).orderBy(asc(togetherAccessPeriods.startsAt));
  return rows.map(toPeriod);
}

export async function getAccessSnapshot(db: Database, spaceId: string): Promise<{ periods: AccessPeriod[]; closedAt: Date | null }> {
  const [space] = await db.select({ closedAt: togetherSpaces.closedAt }).from(togetherSpaces).where(eq(togetherSpaces.id, spaceId)).limit(1);
  return { periods: await listAccessPeriods(db, spaceId), closedAt: space?.closedAt ?? null };
}

export async function hasAccessPeriod(db: Database, purchaseId: string): Promise<boolean> {
  const [row] = await db.select({ id: togetherAccessPeriods.id }).from(togetherAccessPeriods).where(eq(togetherAccessPeriods.purchaseId, purchaseId)).limit(1);
  return row !== undefined;
}

// Единственное место, где появляется оплаченный интервал. Блокировка пространства выстраивает одновременные выдачи в очередь,
// уникальный purchase_id делает повтор безопасным
export async function grantAccessPeriod(db: Database, p: { spaceId: string; purchaseId: string; paidAt: Date }): Promise<GrantOutcome> {
  return db.transaction(async (tx): Promise<GrantOutcome> => {
    const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, p.spaceId)).for("update");
    if (!space) return { ok: false, reason: "space_not_found" };
    const [existing] = await tx.select().from(togetherAccessPeriods).where(eq(togetherAccessPeriods.purchaseId, p.purchaseId)).limit(1);
    if (existing) return { ok: true, created: false, period: toPeriod(existing) };
    if (space.status !== "active") return { ok: false, reason: "space_closed" };
    const period = nextPeriod(await listAccessPeriods(tx, p.spaceId), p.paidAt);
    await tx.insert(togetherAccessPeriods).values({ spaceId: p.spaceId, purchaseId: p.purchaseId, startsAt: period.startsAt, endsAt: period.endsAt });
    return { ok: true, created: true, period };
  });
}

// Проверка «можно ли платить», повторное использование открытой оплаты и создание покупки — под одной блокировкой пространства.
// Свежая покупка без страницы оплаты значит «платёж создаётся прямо сейчас»: второй запрос получает busy и повторяет,
// поэтому два участника (или двойной клик) не получают две живые страницы оплаты
export async function reserveSpacePurchase(
  db: Database,
  p: { spaceId: string; userId: string; amountKopecks: number; receiptEmail: string; now: Date; reuseSince: Date },
): Promise<ReserveOutcome> {
  return db.transaction(async (tx): Promise<ReserveOutcome> => {
    const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, p.spaceId)).for("update");
    if (!space || space.status !== "active") return { kind: "not_available" };
    if (!canRenew(await listAccessPeriods(tx, p.spaceId), p.now)) return { kind: "not_available" };
    const [open] = await tx
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.spaceId, p.spaceId),
          eq(purchases.product, TOGETHER_PRODUCT),
          eq(purchases.status, "pending"),
          gte(purchases.createdAt, p.reuseSince),
        ),
      )
      .orderBy(desc(purchases.createdAt))
      .limit(1);
    if (open) return open.confirmationUrl ? { kind: "reused", purchase: toPurchaseRecord(open) } : { kind: "busy" };
    const [created] = await tx
      .insert(purchases)
      .values({ userId: p.userId, product: TOGETHER_PRODUCT, spaceId: p.spaceId, amountKopecks: p.amountKopecks, receiptEmail: p.receiptEmail, createdAt: p.now })
      .returning();
    return { kind: "created", purchase: toPurchaseRecord(created!) };
  });
}

// Оплачено, но доступа нет (например, пространство закрылось до выдачи): владелец решает вручную, платёж не теряется молча
export async function listPaidWithoutAccess(db: Database): Promise<PaidWithoutAccess[]> {
  return db
    .select({ purchaseId: purchases.id, spaceId: purchases.spaceId, userId: purchases.userId, paidAt: purchases.paidAt, amountKopecks: purchases.amountKopecks })
    .from(purchases)
    .leftJoin(togetherAccessPeriods, eq(togetherAccessPeriods.purchaseId, purchases.id))
    .where(and(eq(purchases.product, TOGETHER_PRODUCT), eq(purchases.status, "succeeded"), isNull(togetherAccessPeriods.id)))
    .orderBy(asc(purchases.paidAt));
}

// Закрытые пространства с неиспользованным оплаченным сроком: остаток не возвращается автоматически, решение за владельцем
export async function listClosedWithRemaining(db: Database): Promise<ClosedWithRemaining[]> {
  const rows = await db
    .select({
      spaceId: togetherSpaces.id,
      closedAt: togetherSpaces.closedAt,
      closedReason: togetherSpaces.closedReason,
      startsAt: togetherAccessPeriods.startsAt,
      endsAt: togetherAccessPeriods.endsAt,
    })
    .from(togetherSpaces)
    .innerJoin(togetherAccessPeriods, eq(togetherAccessPeriods.spaceId, togetherSpaces.id))
    .where(eq(togetherSpaces.status, "closed"))
    .orderBy(asc(togetherSpaces.closedAt));
  const bySpace = new Map<string, { closedAt: Date; closedReason: TogetherClosedReason | null; periods: AccessPeriod[] }>();
  for (const row of rows) {
    if (!row.closedAt) continue;
    const entry = bySpace.get(row.spaceId) ?? { closedAt: row.closedAt, closedReason: row.closedReason, periods: [] };
    bySpace.set(row.spaceId, { ...entry, periods: [...entry.periods, toPeriod(row)] });
  }
  return [...bySpace.entries()]
    .map(([spaceId, entry]) => ({ spaceId, closedAt: entry.closedAt, closedReason: entry.closedReason, remainingMs: unusedPaidMs(entry.periods, entry.closedAt) }))
    .filter((entry) => entry.remainingMs > 0)
    .map(({ remainingMs, ...entry }) => ({ ...entry, remainingDays: Math.ceil(remainingMs / DAY_MS) }));
}
