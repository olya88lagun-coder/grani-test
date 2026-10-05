import { isTogetherProduct, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import {
  attachPayment,
  getActiveSpaceForUser,
  getPurchase,
  grantAccessPeriod,
  hasAccessPeriod,
  markPurchaseCanceled,
  reserveSpacePurchase,
  setReceiptEmail,
  type GrantOutcome,
  type PurchaseStatus,
} from "@grani/db";
import { normalizeReceiptEmail, syncPayment, type PaymentsDeps } from "./payments-service";

// Попадает в чек «Мой налог» — название услуги
export const TOGETHER_DESCRIPTION = "Доступ к «Грани. Вдвоём» на 30 дней для двоих";

const REUSE_WINDOW_MS = 30 * 60_000;

export type StartTogetherOutcome =
  | { ok: true; url: string; purchaseId: string }
  | { ok: false; error: "invalid_email" | "not_found" | "not_available" | "payment_failed" };

export async function startTogetherPurchase(deps: PaymentsDeps, p: { userId: string; email: unknown }): Promise<StartTogetherOutcome> {
  const email = normalizeReceiptEmail(p.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const snapshot = await getActiveSpaceForUser(deps.db, p.userId);
  if (!snapshot) return { ok: false, error: "not_found" };

  const now = deps.now();
  const reserved = await reserveSpacePurchase(deps.db, {
    spaceId: snapshot.space.id,
    userId: p.userId,
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: email,
    now,
    reuseSince: new Date(now.getTime() - REUSE_WINDOW_MS),
  });
  if (reserved.kind === "not_available") return { ok: false, error: "not_available" };
  const { purchase } = reserved;
  if (reserved.kind === "reused" && purchase.confirmationUrl) {
    if (purchase.receiptEmail !== email) await setReceiptEmail(deps.db, purchase.id, email);
    return { ok: true, url: purchase.confirmationUrl, purchaseId: purchase.id };
  }
  return createGatewayPayment(deps, purchase.id, purchase.amountKopecks);
}

async function createGatewayPayment(deps: PaymentsDeps, purchaseId: string, amountKopecks: number): Promise<StartTogetherOutcome> {
  try {
    const payment = await deps.gateway.createPayment({
      purchaseId,
      amountKopecks,
      description: TOGETHER_DESCRIPTION,
      returnUrl: new URL(`/together?purchase=${purchaseId}`, deps.appUrl).toString(),
    });
    if (!payment.confirmationUrl) throw new Error("payment has no confirmation url");
    await attachPayment(deps.db, purchaseId, { paymentId: payment.id, confirmationUrl: payment.confirmationUrl });
    return { ok: true, url: payment.confirmationUrl, purchaseId };
  } catch (error) {
    console.error("together payment was not created", { purchaseId, error: String(error) });
    await markPurchaseCanceled(deps.db, purchaseId);
    return { ok: false, error: "payment_failed" };
  }
}

// Выдаёт период по уже подтверждённой покупке. Безопасно вызывать сколько угодно раз: уникальный purchase_id не даст второго периода
export async function healTogetherAccess(deps: PaymentsDeps, purchaseId: string): Promise<GrantOutcome | null> {
  const purchase = await getPurchase(deps.db, purchaseId);
  if (!purchase || !isTogetherProduct(purchase.product) || purchase.status !== "succeeded" || !purchase.spaceId) return null;
  return grantAccessPeriod(deps.db, { spaceId: purchase.spaceId, purchaseId: purchase.id, paidAt: purchase.paidAt ?? deps.now() });
}

export async function getTogetherPurchaseStatus(
  deps: PaymentsDeps,
  p: { purchaseId: string; userId: string },
): Promise<{ id: string; status: PurchaseStatus; granted: boolean } | null> {
  let purchase = await getPurchase(deps.db, p.purchaseId);
  if (!purchase || !isTogetherProduct(purchase.product)) return null;
  // Покупку видят плательщик и действующие участники пространства; чужим она не существует
  const snapshot = await getActiveSpaceForUser(deps.db, p.userId);
  const isMember = snapshot !== null && snapshot.space.id === purchase.spaceId;
  if (purchase.userId !== p.userId && !isMember) return null;

  if (purchase.status === "pending" && purchase.yookassaPaymentId) purchase = (await syncPayment(deps, purchase.yookassaPaymentId)) ?? purchase;
  if (purchase.status === "succeeded") await healTogetherAccess(deps, purchase.id);
  return { id: purchase.id, status: purchase.status, granted: await hasAccessPeriod(deps.db, purchase.id) };
}
