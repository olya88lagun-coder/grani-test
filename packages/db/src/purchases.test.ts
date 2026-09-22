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
