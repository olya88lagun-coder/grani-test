import type { Product, PurchaseProduct } from "@grani/core";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull } from "drizzle-orm";
import { targetColumns, targetId, type ReportTarget } from "./reports";
import { purchases, type PurchaseStatus } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type { PurchaseStatus } from "./schema";
export type PurchaseTarget = ReportTarget | { spaceId: string };
export type PurchaseRecord = {
  id: string;
  userId: string;
  product: PurchaseProduct;
  resultId: string | null;
  pairId: string | null;
  spaceId: string | null;
  amountKopecks: number;
  status: PurchaseStatus;
  yookassaPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
  receiptEmail: string | null;
  receiptSentAt: Date | null;
};

type PurchaseRow = typeof purchases.$inferSelect;

export const toPurchaseRecord = (row: PurchaseRow): PurchaseRecord => ({ ...row, product: row.product as PurchaseProduct });

function targetWhere(target: ReportTarget) {
  return "resultId" in target ? eq(purchases.resultId, target.resultId) : eq(purchases.pairId, target.pairId);
}

function purchaseTargetColumns(target: PurchaseTarget): { resultId: string | null; pairId: string | null; spaceId: string | null } {
  return "spaceId" in target ? { resultId: null, pairId: null, spaceId: target.spaceId } : { ...targetColumns(target), spaceId: null };
}

export async function createPurchase(
  db: Database,
  p: { userId: string; product: PurchaseProduct; target: PurchaseTarget; amountKopecks: number; receiptEmail?: string | null },
): Promise<PurchaseRecord> {
  const [row] = await db
    .insert(purchases)
    .values({ userId: p.userId, product: p.product, ...purchaseTargetColumns(p.target), amountKopecks: p.amountKopecks, receiptEmail: p.receiptEmail ?? null })
    .returning();
  return toPurchaseRecord(row!);
}

export async function attachPayment(db: Database, purchaseId: string, p: { paymentId: string; confirmationUrl: string }): Promise<void> {
  await db.update(purchases).set({ yookassaPaymentId: p.paymentId, confirmationUrl: p.confirmationUrl }).where(eq(purchases.id, purchaseId));
}

export async function getPurchase(db: Database, purchaseId: string): Promise<PurchaseRecord | null> {
  if (!isUuid(purchaseId)) return null;
  const [row] = await db.select().from(purchases).where(eq(purchases.id, purchaseId)).limit(1);
  return row ? toPurchaseRecord(row) : null;
}

export async function getPurchaseByPaymentId(db: Database, paymentId: string): Promise<PurchaseRecord | null> {
  const [row] = await db.select().from(purchases).where(eq(purchases.yookassaPaymentId, paymentId)).limit(1);
  return row ? toPurchaseRecord(row) : null;
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
  return row ? toPurchaseRecord(row) : null;
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

export async function setReceiptEmail(db: Database, purchaseId: string, email: string): Promise<void> {
  await db.update(purchases).set({ receiptEmail: email }).where(eq(purchases.id, purchaseId));
}

export type ReceiptToSend = { id: string; product: PurchaseProduct; amountKopecks: number; paidAt: Date | null; paymentId: string | null; email: string | null };

// Оплаченные покупки, по которым чек «Мой налог» ещё не отправлен — для страницы чеков владелицы
export async function listReceiptsToSend(db: Database): Promise<ReceiptToSend[]> {
  const rows = await db
    .select({
      id: purchases.id,
      product: purchases.product,
      amountKopecks: purchases.amountKopecks,
      paidAt: purchases.paidAt,
      paymentId: purchases.yookassaPaymentId,
      email: purchases.receiptEmail,
    })
    .from(purchases)
    // Бесплатные покупки владелицы — не доход, чек по ним не нужен
    .where(and(eq(purchases.status, "succeeded"), isNull(purchases.receiptSentAt), gt(purchases.amountKopecks, 0)))
    .orderBy(asc(purchases.paidAt));
  return rows.map((row) => ({ ...row, product: row.product as PurchaseProduct }));
}

// Чек отправлен — почта больше не нужна и стирается
export async function markReceiptSent(db: Database, purchaseId: string, sentAt: Date): Promise<boolean> {
  if (!isUuid(purchaseId)) return false;
  const updated = await db
    .update(purchases)
    .set({ receiptSentAt: sentAt, receiptEmail: null })
    .where(and(eq(purchases.id, purchaseId), eq(purchases.status, "succeeded"), isNull(purchases.receiptSentAt)))
    .returning({ id: purchases.id });
  return updated.length > 0;
}
