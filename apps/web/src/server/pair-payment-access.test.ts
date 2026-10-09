import { unlockedKinds } from "@grani/core";
import { createTestDb, getPurchase, seedPair, seedUserWithResult, type Database } from "@grani/db/testing";
import { listOwnedProducts } from "@grani/db";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { GatewayPayment } from "./payments/gateway";
import { getPurchaseView, startPurchase, syncPayment, type PaymentsDeps } from "./payments-service";

let db: Database;
let pair: Awaited<ReturnType<typeof seedPair>>;
let store: Map<string, GatewayPayment>;
let gateway: FakeGateway;
let deps: PaymentsDeps;

beforeEach(async () => {
  db = await createTestDb();
  pair = await seedPair(db);
  store = new Map();
  gateway = createFakeGateway({ appUrl: "http://localhost:3000", store });
  deps = { db, gateway, appUrl: "http://localhost:3000", now: () => new Date("2026-10-09T12:00:00Z"),
    enqueueGenerate: vi.fn().mockResolvedValue(undefined), remindReceipts: vi.fn().mockResolvedValue(undefined), isOwner: async () => false };
});

afterEach(async () => { await (db as unknown as { $client: { close(): Promise<void> } }).$client.close(); });

async function start() {
  const result = await startPurchase(deps, { userId: pair.a.userId, product: "pair", targetId: pair.pairId, email: "pair-qa@example.test" });
  if (!result.ok) throw new Error(result.error);
  return store.get(result.url.split("/dev/pay/")[1]!)!;
}

const access = async () => unlockedKinds(await listOwnedProducts(db, { pairId: pair.pairId })).has("pair");

test("a pair costs 399 rubles on the server and opens to both only after confirmed payment", async () => {
  const payment = await start();
  expect(payment.amountKopecks).toBe(39900);
  expect((await syncPayment(deps, payment.id))?.status).toBe("pending");
  expect(await access()).toBe(false);
  gateway.complete(payment.id, "succeeded");
  expect((await syncPayment(deps, payment.id))?.status).toBe("succeeded");
  expect(await access()).toBe(true);
  expect(await startPurchase(deps, { userId: pair.b.userId, product: "pair", targetId: pair.pairId, email: "second-qa@example.test" }))
    .toEqual({ ok: false, error: "not_available" });
  await syncPayment(deps, payment.id);
  expect(deps.enqueueGenerate).toHaveBeenCalledTimes(1);
  expect(deps.enqueueGenerate).toHaveBeenCalledWith({ kind: "pair", pairId: pair.pairId });
});

test.each([
  ["wrong amount", { amountKopecks: 1 }],
  ["wrong purchase", { purchaseId: "another-purchase" }],
  ["not paid", { paid: false }],
] as const)("a succeeded response with %s never opens the map", async (_, invalid) => {
  const payment = await start();
  store.set(payment.id, { ...payment, status: "succeeded", paid: true, ...invalid });
  expect((await syncPayment(deps, payment.id))?.status).toBe("pending");
  expect(await access()).toBe(false);
  expect(deps.enqueueGenerate).not.toHaveBeenCalled();
});

test("cancellation leaves the map locked and permits a new purchase", async () => {
  const payment = await start();
  gateway.complete(payment.id, "canceled");
  expect((await syncPayment(deps, payment.id))?.status).toBe("canceled");
  expect(await access()).toBe(false);
  const next = await start();
  expect(next.id).not.toBe(payment.id);
  expect(next.amountKopecks).toBe(39900);
});

test("outsiders cannot buy the pair; purchase details remain private to the payer", async () => {
  const outsider = await seedUserWithResult(db, { externalId: "pair-payment-outsider" });
  expect(await startPurchase(deps, { userId: outsider.userId, product: "pair", targetId: pair.pairId, email: "outsider-qa@example.test" }))
    .toEqual({ ok: false, error: "not_found" });
  const payment = await start();
  gateway.complete(payment.id, "succeeded");
  await syncPayment(deps, payment.id);
  const purchaseId = payment.purchaseId!;
  expect((await getPurchase(db, purchaseId))?.amountKopecks).toBe(39900);
  expect(await getPurchaseView(deps, { purchaseId, userId: pair.b.userId })).toBeNull();
  expect(await getPurchaseView(deps, { purchaseId, userId: outsider.userId })).toBeNull();
  expect(await access()).toBe(true);
});
