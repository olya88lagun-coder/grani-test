import { beforeAll, expect, test, vi } from "vitest";
import { attachPayment, createPurchase, createTestDb, getPurchase, markPurchaseSucceeded, seedUserWithResult, type Database, type PurchaseRecord } from "@grani/db/testing";
import type { GatewayPayment } from "./payments/gateway";
import { purchaseAnalyticsPayload, readPurchaseAnalytics } from "./purchase-analytics";

const NOW = new Date("2026-10-19T10:00:00Z");
const order: PurchaseRecord = {
  id: "00000000-0000-4000-8000-000000000001", userId: "owner", product: "full",
  status: "succeeded", amountKopecks: 16900, yookassaPaymentId: "provider-payment",
  paidAt: NOW, createdAt: NOW, confirmationUrl: null, receiptEmail: null, receiptSentAt: null,
  resultId: "private-result", pairId: null, spaceId: null,
};
const payment = {
  id: "provider-payment", purchaseId: order.id, status: "succeeded", paid: true,
  amountKopecks: 16900, currency: "RUB", test: false, confirmationUrl: null,
} as GatewayPayment;

test("verified real payment yields paid historical amount, product and an opaque transaction ID", () => {
  const data = purchaseAnalyticsPayload(order, payment);
  expect(data).toMatchObject({ product: "full", amountKopecks: 16900, currency: "RUB" });
  expect(data?.id).toMatch(/^order_[a-f0-9]{64}$/);
  expect(data?.id).not.toContain(order.id);
  expect(purchaseAnalyticsPayload(order, payment)?.id).toBe(data?.id);
  expect(JSON.stringify(data)).not.toContain("private-result");
});

test.each([
  { test: true }, { test: undefined }, { currency: undefined }, { currency: "USD" },
  { paid: false }, { status: "waiting_for_capture" }, { id: "other-payment" },
  { purchaseId: "other-order" }, { amountKopecks: 9900 },
])("excludes unverified provider data: %j", patch => {
  expect(purchaseAnalyticsPayload(order, { ...payment, ...patch } as GatewayPayment)).toBeNull();
});

test.each([
  { status: "pending" }, { status: "canceled" }, { status: "refunded" }, { amountKopecks: 0 },
  { paidAt: null }, { yookassaPaymentId: null }, { product: "together_30d" },
])("excludes non-sales records: %j", patch => {
  expect(purchaseAnalyticsPayload({ ...order, ...patch } as PurchaseRecord, payment)).toBeNull();
});

let db: Database;
beforeAll(async () => { db = await createTestDb(); });
test("the read-only service checks ownership before the provider and never alters paid access", async () => {
  const owner = await seedUserWithResult(db, { externalId: "analytics-owner" });
  const purchase = await createPurchase(db, { userId: owner.userId, product: "full", target: { resultId: owner.resultId }, amountKopecks: 16900 });
  await attachPayment(db, purchase.id, { paymentId: "real-provider-id", confirmationUrl: "https://provider.test" });
  await markPurchaseSucceeded(db, purchase.id, NOW);
  const before = await getPurchase(db, purchase.id);
  const getPayment = vi.fn(async () => ({ ...payment, id: "real-provider-id", purchaseId: purchase.id }));
  const deps = { db, gateway: { getPayment } };
  expect(await readPurchaseAnalytics(deps, { purchaseId: purchase.id, userId: "foreign" })).toEqual({ found: false });
  expect(getPayment).not.toHaveBeenCalled();
  expect(await readPurchaseAnalytics(deps, { purchaseId: purchase.id, userId: owner.userId })).toMatchObject({ found: true, purchase: { amountKopecks: 16900 } });
  expect(await getPurchase(db, purchase.id)).toEqual(before);
  getPayment.mockRejectedValueOnce(new Error("provider offline"));
  await expect(readPurchaseAnalytics(deps, { purchaseId: purchase.id, userId: owner.userId })).rejects.toThrow("provider offline");
  expect(await getPurchase(db, purchase.id)).toEqual(before);
});
