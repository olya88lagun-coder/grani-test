import { createHash } from "node:crypto";
import { isProduct, isTogetherProduct } from "@grani/core";
import { getPurchase, type Database, type PurchaseRecord } from "@grani/db";
import type { ConfirmedPurchase } from "@/lib/confirmed-purchase";
import type { GatewayPayment, PaymentGateway } from "./payments/gateway";

type AnalyticsMode = { sandbox?: boolean; together?: boolean };

function supportsProduct(product: unknown, mode: AnalyticsMode): product is ConfirmedPurchase["product"] {
  return isProduct(product) || (!!(mode.sandbox || mode.together) && isTogetherProduct(product));
}

// Независимая проверка аналитики: никаких переходов статуса, выдачи доступа или постановки отчётов.
export function purchaseAnalyticsPayload(purchase: PurchaseRecord, payment: GatewayPayment | null, mode: AnalyticsMode = {}): ConfirmedPurchase | null {
  if (purchase.status !== "succeeded" || !purchase.paidAt || !supportsProduct(purchase.product, mode)
    || !Number.isSafeInteger(purchase.amountKopecks) || purchase.amountKopecks <= 0 || !purchase.yookassaPaymentId) return null;
  if (!payment || payment.test !== (mode.sandbox === true) || payment.currency !== "RUB" || payment.status !== "succeeded" || !payment.paid
    || payment.id !== purchase.yookassaPaymentId || (!mode.sandbox && payment.id.startsWith("fake-"))
    || payment.purchaseId !== purchase.id || payment.amountKopecks !== purchase.amountKopecks) return null;
  return {
    id: `order_${createHash("sha256").update(`grani:purchase-analytics:${purchase.id}`).digest("hex")}`,
    product: purchase.product,
    amountKopecks: purchase.amountKopecks,
    currency: "RUB",
  };
}

export async function readPurchaseAnalytics(
  deps: { db: Database; gateway: Pick<PaymentGateway, "getPayment"> },
  p: { purchaseId: string; userId: string },
  mode: AnalyticsMode = {},
): Promise<{ found: false } | { found: true; purchase: ConfirmedPurchase | null }> {
  const purchase = await getPurchase(deps.db, p.purchaseId);
  if (!purchase || purchase.userId !== p.userId) return { found: false };
  if (purchase.status !== "succeeded" || purchase.amountKopecks <= 0 || !purchase.yookassaPaymentId || !supportsProduct(purchase.product, mode)) {
    return { found: true, purchase: null };
  }
  const payment = await deps.gateway.getPayment(purchase.yookassaPaymentId);
  return { found: true, purchase: purchaseAnalyticsPayload(purchase, payment, mode) };
}
