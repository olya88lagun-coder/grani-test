import { FRIEND_ITEMS } from "@grani/content";
import {
  addFriendResponse,
  createTestDb,
  getOrCreateInvite,
  getPurchase,
  saveReport,
  seedPair,
  seedUserWithResult,
  type Database,
} from "@grani/db/testing";
import type { GenerateJob } from "@grani/core";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { GatewayPayment } from "./payments/gateway";
import { getPurchaseView, startPurchase, syncPayment, type PaymentsDeps } from "./payments-service";

const APP_URL = "http://localhost:3000";
const NOW = new Date("2026-09-22T10:00:00Z");

let db: Database;
let store: Map<string, GatewayPayment>;
let gateway: FakeGateway;
let deps: PaymentsDeps;
let enqueue: Mock<(job: GenerateJob) => Promise<void>>;
let anna: { userId: string; resultId: string };

beforeEach(async () => {
  db = await createTestDb();
  store = new Map();
  gateway = createFakeGateway({ appUrl: APP_URL, store });
  enqueue = vi.fn<(job: GenerateJob) => Promise<void>>().mockResolvedValue(undefined);
  deps = { db, gateway, appUrl: APP_URL, now: () => NOW, enqueueGenerate: enqueue };
  anna = await seedUserWithResult(db, { externalId: "anna" });
});

const paymentOf = (url: string) => url.split("/dev/pay/")[1]!;

async function buyAndPay(product: string, targetId = anna.resultId, userId = anna.userId) {
  const outcome = await startPurchase(deps, { userId, product, targetId });
  if (!outcome.ok) throw new Error(outcome.error);
  gateway.complete(paymentOf(outcome.url), "succeeded");
  return syncPayment(deps, paymentOf(outcome.url));
}

describe("startPurchase", () => {
  test("creates a payment for the server price and returns the payment page", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });

    expect(outcome.ok).toBe(true);
    const payment = store.get(paymentOf(outcome.ok ? outcome.url : ""))!;
    expect(payment.amountKopecks).toBe(29900);
    expect(await getPurchase(db, payment.purchaseId!)).toMatchObject({ status: "pending", yookassaPaymentId: payment.id, product: "full" });
  });

  test("reuses the payment page of a recent unfinished purchase", async () => {
    const first = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const second = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });

    expect(second).toEqual(first);
    expect(store.size).toBe(1);
  });

  test("refuses unknown products, foreign targets and what the rules do not allow", async () => {
    const boris = await seedUserWithResult(db, { externalId: "boris" });

    expect(await startPurchase(deps, { userId: anna.userId, product: "gold", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: boris.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: anna.userId, product: "pair", targetId: anna.resultId })).toEqual({ ok: false, error: "not_found" });
    expect(await startPurchase(deps, { userId: anna.userId, product: "chapter_money", targetId: anna.resultId })).toEqual({ ok: false, error: "not_available" });
    await buyAndPay("full");
    expect(await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "not_available" });
  });

  test("a failed payment request cancels the purchase", async () => {
    deps.gateway = { ...gateway, createPayment: vi.fn().mockRejectedValue(new Error("503")) };

    expect(await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId })).toEqual({ ok: false, error: "payment_failed" });
  });
});

describe("syncPayment", () => {
  test("a pending payment changes nothing, a paid one succeeds once and enqueues generation once", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");

    expect((await syncPayment(deps, paymentId))?.status).toBe("pending");
    gateway.complete(paymentId, "succeeded");
    expect((await syncPayment(deps, paymentId))?.status).toBe("succeeded");
    await syncPayment(deps, paymentId);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
  });

  test("ignores a payment whose amount or purchase does not match", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");
    store.set(paymentId, { ...store.get(paymentId)!, status: "succeeded", paid: true, amountKopecks: 100 });

    expect((await syncPayment(deps, paymentId))?.status).toBe("pending");
    expect(enqueue).not.toHaveBeenCalled();
    expect(await syncPayment(deps, "unknown")).toBeNull();
  });

  test("a canceled payment cancels the purchase", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const paymentId = paymentOf(outcome.ok ? outcome.url : "");
    gateway.complete(paymentId, "canceled");

    expect((await syncPayment(deps, paymentId))?.status).toBe("canceled");
  });

  test("the bundle enqueues four chapters, the pair report goes to the pair", async () => {
    await buyAndPay("full");
    enqueue.mockClear();
    await buyAndPay("chapters_all");
    const { pairId, b } = await seedPair(db);
    await buyAndPay("pair", pairId, b.userId);

    expect(enqueue.mock.calls.map((call) => call[0])).toEqual([
      { kind: "chapter_money", resultId: anna.resultId },
      { kind: "chapter_conflict", resultId: anna.resultId },
      { kind: "chapter_stress", resultId: anna.resultId },
      { kind: "chapter_relationships", resultId: anna.resultId },
      { kind: "pair", pairId },
    ]);
  });

  test("the full report brings the friends section when three friends already answered", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, anna.resultId);
    const answers = Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, 3 as const]));
    for (const device of ["a", "b", "c"]) await addFriendResponse(db, { inviteId, answers, deviceHash: device });

    await buyAndPay("full");

    expect(enqueue).toHaveBeenCalledWith({ kind: "friends", resultId: anna.resultId });
  });
});

describe("getPurchaseView", () => {
  test("syncs a pending purchase, reports readiness and hides other people's purchases", async () => {
    const outcome = await startPurchase(deps, { userId: anna.userId, product: "full", targetId: anna.resultId });
    const payment = store.get(paymentOf(outcome.ok ? outcome.url : ""))!;
    gateway.complete(payment.id, "succeeded");
    const purchaseId = payment.purchaseId!;

    expect(await getPurchaseView(deps, { purchaseId, userId: anna.userId })).toEqual({
      id: purchaseId,
      product: "full",
      status: "succeeded",
      ready: false,
      reportUrl: `/report/${anna.resultId}`,
    });
    await saveReport(db, { target: { resultId: anna.resultId }, kind: "full", sections: {}, source: "fallback" });
    expect((await getPurchaseView(deps, { purchaseId, userId: anna.userId }))?.ready).toBe(true);
    expect(await getPurchaseView(deps, { purchaseId, userId: "00000000-0000-0000-0000-000000000000" })).toBeNull();
  });

  test("enqueues missing reports of a paid purchase again", async () => {
    await buyAndPay("full");
    const purchaseId = [...store.values()][0]!.purchaseId!;
    enqueue.mockClear();

    await getPurchaseView(deps, { purchaseId, userId: anna.userId });

    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
  });
});
