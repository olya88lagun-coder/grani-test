import { canBuy, friendsReportDue, isProduct, PRODUCT_PRICES, productTarget, reportKindsFor, type GenerateJob, type Product } from "@grani/core";
import {
  attachPayment,
  countFriendResponses,
  createPurchase,
  findOpenPurchase,
  getInviteForResult,
  getPairForMember,
  getPurchase,
  getPurchaseByPaymentId,
  getResultForOwner,
  listOwnedProducts,
  listReports,
  markPurchaseCanceled,
  markPurchaseSucceeded,
  type Database,
  type PurchaseRecord,
  type PurchaseStatus,
  type ReportTarget,
} from "@grani/db";
import type { PaymentGateway } from "./payments/gateway";

export type PaymentsDeps = { db: Database; gateway: PaymentGateway; appUrl: string; now: () => Date; enqueueGenerate: (job: GenerateJob) => Promise<void> };
export type StartPurchaseOutcome = { ok: true; url: string } | { ok: false; error: "not_found" | "not_available" | "payment_failed" };
export type PurchaseView = { id: string; product: Product; status: PurchaseStatus; ready: boolean; reportUrl: string };

const REUSE_WINDOW_MS = 30 * 60_000;

// Попадает в чек «Мой налог» — название услуги, до 128 знаков
export const PRODUCT_DESCRIPTIONS: Readonly<Record<Product, string>> = {
  full: "Полный разбор личности «Грани»",
  chapter_money: "Глава «Деньги» к разбору личности «Грани»",
  chapter_conflict: "Глава «Конфликты» к разбору личности «Грани»",
  chapter_stress: "Глава «Стресс» к разбору личности «Грани»",
  chapter_relationships: "Глава «Отношения» к разбору личности «Грани»",
  chapters_all: "Четыре главы к разбору личности «Грани»",
  pair: "Разбор совместимости пары «Грани»",
};

async function resolveTarget(db: Database, userId: string, product: Product, targetId: string): Promise<ReportTarget | null> {
  if (productTarget(product) === "pair") return (await getPairForMember(db, targetId, userId)) ? { pairId: targetId } : null;
  return (await getResultForOwner(db, targetId, userId)) ? { resultId: targetId } : null;
}

const purchaseTarget = (purchase: PurchaseRecord): ReportTarget | null =>
  purchase.pairId ? { pairId: purchase.pairId } : purchase.resultId ? { resultId: purchase.resultId } : null;

function jobsFor(product: Product, target: ReportTarget): GenerateJob[] {
  if ("pairId" in target) return [{ kind: "pair", pairId: target.pairId }];
  return reportKindsFor(product).flatMap((kind): GenerateJob[] => (kind === "pair" ? [] : [{ kind, resultId: target.resultId }]));
}

async function friendsCount(db: Database, resultId: string): Promise<number> {
  const invite = await getInviteForResult(db, resultId);
  return invite ? countFriendResponses(db, invite.id) : 0;
}

async function enqueuePaid(deps: PaymentsDeps, purchase: PurchaseRecord): Promise<void> {
  const target = purchaseTarget(purchase);
  if (!target) return;
  const jobs = jobsFor(purchase.product, target);
  if ("resultId" in target && purchase.product === "full" && friendsReportDue(["full"], await friendsCount(deps.db, target.resultId))) {
    jobs.push({ kind: "friends", resultId: target.resultId });
  }
  for (const job of jobs) await deps.enqueueGenerate(job);
}

export async function startPurchase(deps: PaymentsDeps, p: { userId: string; product: unknown; targetId: unknown }): Promise<StartPurchaseOutcome> {
  if (!isProduct(p.product) || typeof p.targetId !== "string") return { ok: false, error: "not_found" };
  const product = p.product;
  const target = await resolveTarget(deps.db, p.userId, product, p.targetId);
  if (!target) return { ok: false, error: "not_found" };
  if (!canBuy(product, await listOwnedProducts(deps.db, target))) return { ok: false, error: "not_available" };

  const since = new Date(deps.now().getTime() - REUSE_WINDOW_MS);
  const open = await findOpenPurchase(deps.db, { userId: p.userId, product, target, since });
  if (open?.confirmationUrl) return { ok: true, url: open.confirmationUrl };

  const purchase = await createPurchase(deps.db, { userId: p.userId, product, target, amountKopecks: PRODUCT_PRICES[product] });
  try {
    const payment = await deps.gateway.createPayment({
      purchaseId: purchase.id,
      amountKopecks: purchase.amountKopecks,
      description: PRODUCT_DESCRIPTIONS[product],
      returnUrl: new URL(`/purchases/${purchase.id}`, deps.appUrl).toString(),
    });
    if (!payment.confirmationUrl) throw new Error("payment has no confirmation url");
    await attachPayment(deps.db, purchase.id, { paymentId: payment.id, confirmationUrl: payment.confirmationUrl });
    return { ok: true, url: payment.confirmationUrl };
  } catch (error) {
    console.error("payment was not created", { purchaseId: purchase.id, error: String(error) });
    await markPurchaseCanceled(deps.db, purchase.id);
    return { ok: false, error: "payment_failed" };
  }
}

// Единственное место, где меняется статус покупки: по ответу API шлюза, а не по телу уведомления
export async function syncPayment(deps: PaymentsDeps, paymentId: string): Promise<PurchaseRecord | null> {
  const purchase = await getPurchaseByPaymentId(deps.db, paymentId);
  if (!purchase) return null;
  if (purchase.status !== "pending") return purchase;
  const payment = await deps.gateway.getPayment(paymentId);
  if (!payment) return purchase;
  if (payment.purchaseId !== purchase.id || payment.amountKopecks !== purchase.amountKopecks) {
    console.warn("payment does not match the purchase", { purchaseId: purchase.id, paymentId });
    return purchase;
  }
  if (payment.status === "succeeded" && payment.paid) {
    if (await markPurchaseSucceeded(deps.db, purchase.id, deps.now())) await enqueuePaid(deps, purchase);
  } else if (payment.status === "canceled") {
    await markPurchaseCanceled(deps.db, purchase.id);
  }
  return getPurchase(deps.db, purchase.id);
}

export async function getPurchaseView(deps: PaymentsDeps, p: { purchaseId: string; userId: string }): Promise<PurchaseView | null> {
  let purchase = await getPurchase(deps.db, p.purchaseId);
  if (!purchase || purchase.userId !== p.userId) return null;
  if (purchase.status === "pending" && purchase.yookassaPaymentId) purchase = (await syncPayment(deps, purchase.yookassaPaymentId)) ?? purchase;

  const target = purchaseTarget(purchase);
  const reportUrl = !target ? "/me" : "pairId" in target ? `/pair/${target.pairId}` : `/report/${target.resultId}`;
  if (!target) return { id: purchase.id, product: purchase.product, status: purchase.status, ready: false, reportUrl };

  const kinds = new Set((await listReports(deps.db, target)).map((report) => report.kind));
  const ready = jobsFor(purchase.product, target).every((job) => kinds.has(job.kind));
  // Задачи могли не встать в очередь в момент оплаты — ставим недостающие ещё раз, id задачи тот же
  if (purchase.status === "succeeded" && !ready) {
    for (const job of jobsFor(purchase.product, target)) if (!kinds.has(job.kind)) await deps.enqueueGenerate(job);
  }
  return { id: purchase.id, product: purchase.product, status: purchase.status, ready, reportUrl };
}
