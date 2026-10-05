import { TOGETHER_PRICE_KOPECKS } from "@grani/core";
import {
  closeSpaceForUser,
  createSpace,
  createTestDb,
  getAccessSnapshot,
  getPurchase,
  hasAccessPeriod,
  listAccessPeriods,
  listPaidWithoutAccess,
  markPurchaseSucceeded,
  seedTogetherSpace,
  seedUser,
  type Database,
} from "@grani/db/testing";
import type { GenerateJob } from "@grani/core";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { GatewayPayment } from "./payments/gateway";
import { startPurchase, syncPayment, type PaymentsDeps } from "./payments-service";
import { getTogetherPurchaseStatus, healTogetherAccess, startTogetherPurchase, TOGETHER_DESCRIPTION } from "./together-payments";

const APP_URL = "http://localhost:3000";
const START = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;
const EMAIL = "anna@example.ru";

let db: Database;
let store: Map<string, GatewayPayment>;
let gateway: FakeGateway;
let clock: Date;
let deps: PaymentsDeps;
let enqueue: Mock<(job: GenerateJob) => Promise<void>>;
let space: { spaceId: string; initiatorId: string; partnerId: string };

const paymentOf = (url: string) => url.split("/dev/pay/")[1]!;

async function start(userId = space.initiatorId, email: unknown = EMAIL) {
  const outcome = await startTogetherPurchase(deps, { userId, email });
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome;
}

async function buyAndPay(userId = space.initiatorId) {
  const outcome = await start(userId);
  gateway.complete(paymentOf(outcome.url), "succeeded");
  await syncPayment(deps, paymentOf(outcome.url));
  return outcome;
}

beforeEach(async () => {
  db = await createTestDb();
  store = new Map();
  gateway = createFakeGateway({ appUrl: APP_URL, store });
  clock = START;
  enqueue = vi.fn<(job: GenerateJob) => Promise<void>>().mockResolvedValue(undefined);
  deps = { db, gateway, appUrl: APP_URL, now: () => clock, enqueueGenerate: enqueue };
  space = await seedTogetherSpace(db);
});

describe("startTogetherPurchase", () => {
  test("creates a payment for the server price with the receipt description", async () => {
    const outcome = await start();

    const payment = store.get(paymentOf(outcome.url))!;
    expect(payment.amountKopecks).toBe(TOGETHER_PRICE_KOPECKS);
    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "pending", spaceId: space.spaceId, product: "together_30d", yookassaPaymentId: payment.id });
    expect(TOGETHER_DESCRIPTION).toBe("Доступ к «Грани. Вдвоём» на 30 дней для двоих");
  });

  test("returns the payment page of a recent unfinished purchase, for either member", async () => {
    const first = await start(space.initiatorId);
    const second = await start(space.partnerId);

    expect(second.url).toBe(first.url);
    expect(second.purchaseId).toBe(first.purchaseId);
    expect(store.size).toBe(1);
  });

  test("needs a valid receipt email and a space of the user", async () => {
    const outsider = await seedUser(db, { externalId: "outsider" });

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: "not-an-email" })).toEqual({ ok: false, error: "invalid_email" });
    expect(await startTogetherPurchase(deps, { userId: outsider, email: EMAIL })).toEqual({ ok: false, error: "not_found" });
  });

  test("is not available while the partner has not joined", async () => {
    const lonely = await seedUser(db, { externalId: "lonely" });
    await createSpace(db, { userId: lonely, now: START });

    expect(await startTogetherPurchase(deps, { userId: lonely, email: EMAIL })).toEqual({ ok: false, error: "not_available" });
  });

  test("allows one period ahead and refuses the next", async () => {
    await buyAndPay();
    await buyAndPay(space.partnerId);

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: EMAIL })).toEqual({ ok: false, error: "not_available" });
  });

  test("a payment that the gateway cannot create is canceled and reported", async () => {
    vi.spyOn(gateway, "createPayment").mockRejectedValueOnce(new Error("gateway down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: EMAIL })).toEqual({ ok: false, error: "payment_failed" });
  });
});

describe("granting access", () => {
  test("one succeeded payment gives exactly one 30-day period, however often it is reported", async () => {
    const outcome = await buyAndPay();
    await syncPayment(deps, paymentOf(outcome.url));
    await syncPayment(deps, paymentOf(outcome.url));

    expect(await listAccessPeriods(db, space.spaceId)).toEqual([{ startsAt: START, endsAt: new Date(START.getTime() + 30 * DAY_MS) }]);
    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "succeeded", paidAt: START });
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("an early payment starts when the current period ends", async () => {
    await buyAndPay();
    clock = new Date(START.getTime() + 10 * DAY_MS);

    await buyAndPay(space.partnerId);

    const periods = await listAccessPeriods(db, space.spaceId);
    expect(periods[1]).toEqual({ startsAt: new Date(START.getTime() + 30 * DAY_MS), endsAt: new Date(START.getTime() + 60 * DAY_MS) });
  });

  test("a payment with a different amount opens nothing", async () => {
    const outcome = await start();
    const id = paymentOf(outcome.url);
    store.set(id, { ...store.get(id)!, status: "succeeded", paid: true, amountKopecks: 100 });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncPayment(deps, id);

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "pending" });
    expect(await listAccessPeriods(db, space.spaceId)).toEqual([]);
  });

  test("a canceled payment opens nothing", async () => {
    const outcome = await start();
    gateway.complete(paymentOf(outcome.url), "canceled");

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "canceled" });
    expect(await listAccessPeriods(db, space.spaceId)).toEqual([]);
  });

  test("a payment that succeeds after the space was closed gives no access and is listed for the owner", async () => {
    const outcome = await start();
    await closeSpaceForUser(db, { userId: space.partnerId, now: clock, reason: "left" });
    gateway.complete(paymentOf(outcome.url), "succeeded");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "succeeded" });
    expect(await hasAccessPeriod(db, outcome.purchaseId)).toBe(false);
    expect(await listPaidWithoutAccess(db)).toMatchObject([{ purchaseId: outcome.purchaseId, spaceId: space.spaceId }]);
    expect((await getAccessSnapshot(db, space.spaceId)).periods).toEqual([]);
  });

  test("a crash between the succeeded status and the grant is healed by the next report", async () => {
    const outcome = await start();
    gateway.complete(paymentOf(outcome.url), "succeeded");
    await markPurchaseSucceeded(db, outcome.purchaseId, START);
    expect(await hasAccessPeriod(db, outcome.purchaseId)).toBe(false);

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await listAccessPeriods(db, space.spaceId)).toHaveLength(1);
    expect(await healTogetherAccess(deps, outcome.purchaseId)).toMatchObject({ ok: true, created: false });
  });
});

describe("getTogetherPurchaseStatus", () => {
  test("both members and the payer see the status; polling confirms a paid purchase", async () => {
    const outcome = await start(space.initiatorId);
    gateway.complete(paymentOf(outcome.url), "succeeded");

    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: space.partnerId })).toEqual({
      id: outcome.purchaseId,
      status: "succeeded",
      granted: true,
    });
    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: space.initiatorId })).toMatchObject({ status: "succeeded", granted: true });
  });

  test("an outsider and a malformed id get nothing", async () => {
    const outcome = await start();
    const outsider = await seedUser(db, { externalId: "outsider" });

    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: outsider })).toBeNull();
    expect(await getTogetherPurchaseStatus(deps, { purchaseId: "nope", userId: space.initiatorId })).toBeNull();
  });
});

describe("old purchase entry points", () => {
  test("the report purchase endpoint refuses the together product", async () => {
    const result = await startPurchase(deps, { userId: space.initiatorId, product: "together_30d", targetId: space.spaceId, email: EMAIL });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});
