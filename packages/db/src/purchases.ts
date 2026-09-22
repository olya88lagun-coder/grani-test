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
