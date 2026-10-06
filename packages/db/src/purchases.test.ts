import { beforeEach, describe, expect, test } from "vitest";
import {
  attachPayment,
  createPurchase,
  createTestDb,
  findOpenPurchase,
  getPurchase,
  getPurchaseByPaymentId,
  listOwnedProducts,
  listReceiptsToSend,
  markPurchaseCanceled,
  markReceiptSent,
  setReceiptEmail,
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

const buyFull = (receiptEmail: string | null = null) =>
  createPurchase(db, { userId: anna.userId, product: "full", target: { resultId: anna.resultId }, amountKopecks: 29900, receiptEmail });

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

  test("lists paid purchases waiting for a receipt, oldest first, with the buyer's email", async () => {
    const first = await buyFull("anna@example.ru");
    const later = await createPurchase(db, { userId: anna.userId, product: "chapter_money", target: { resultId: anna.resultId }, amountKopecks: 9900, receiptEmail: null });
    const unpaid = await createPurchase(db, { userId: anna.userId, product: "chapter_stress", target: { resultId: anna.resultId }, amountKopecks: 9900, receiptEmail: "x@example.ru" });
    await attachPayment(db, first.id, { paymentId: "pay-a", confirmationUrl: "https://yoomoney.ru/a" });
    await markPurchaseSucceeded(db, later.id, new Date("2026-09-23T10:00:00Z"));
    await markPurchaseSucceeded(db, first.id, PAID_AT);

    const receipts = await listReceiptsToSend(db);

    expect(receipts.map((r) => r.id)).toEqual([first.id, later.id]);
    expect(receipts[0]).toEqual({ id: first.id, product: "full", amountKopecks: 29900, paidAt: PAID_AT, paymentId: "pay-a", email: "anna@example.ru" });
    expect(receipts.some((r) => r.id === unpaid.id)).toBe(false);
  });

  test("a sent receipt leaves the list and the email is forgotten", async () => {
    const purchase = await buyFull("anna@example.ru");
    await markPurchaseSucceeded(db, purchase.id, PAID_AT);

    expect(await markReceiptSent(db, purchase.id, new Date())).toBe(true);
    expect(await markReceiptSent(db, purchase.id, new Date())).toBe(false);
    expect(await listReceiptsToSend(db)).toEqual([]);
    expect(await getPurchase(db, purchase.id)).toMatchObject({ receiptEmail: null, receiptSentAt: expect.any(Date) });
  });

  test("a receipt is not marked sent for an unpaid purchase", async () => {
    const purchase = await buyFull("anna@example.ru");
    expect(await markReceiptSent(db, purchase.id, new Date())).toBe(false);
    expect(await markReceiptSent(db, "not-a-uuid", new Date())).toBe(false);
  });

  test("the email of a reused open purchase can be changed", async () => {
    const purchase = await buyFull("old@example.ru");
    await setReceiptEmail(db, purchase.id, "new@example.ru");
    expect(await getPurchase(db, purchase.id)).toMatchObject({ receiptEmail: "new@example.ru" });
  });

  test("free owner purchases need no receipt", async () => {
    const free = await createPurchase(db, { userId: anna.userId, product: "full", target: { resultId: anna.resultId }, amountKopecks: 0 });
    await markPurchaseSucceeded(db, free.id, PAID_AT);
    expect(await listReceiptsToSend(db)).toEqual([]);
  });
});
