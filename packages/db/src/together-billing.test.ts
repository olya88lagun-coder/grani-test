import { TOGETHER_PRICE_KOPECKS, TOGETHER_PRODUCT } from "@grani/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { createPurchase, markPurchaseSucceeded } from "./purchases";
import { purchases } from "./schema";
import {
  getAccessSnapshot,
  grantAccessPeriod,
  hasAccessPeriod,
  listAccessPeriods,
  listClosedWithRemaining,
  listPaidWithoutAccess,
  reserveSpacePurchase,
} from "./together-billing";
import { closeSpaceForUser } from "./together";
import { createTestDb, seedTogetherSpace } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

let db: Database;
let space: { spaceId: string; initiatorId: string; partnerId: string };

async function paidPurchase(paidAt: Date, userId = space.initiatorId) {
  const purchase = await createPurchase(db, {
    userId,
    product: TOGETHER_PRODUCT,
    target: { spaceId: space.spaceId },
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: "anna@example.ru",
  });
  await markPurchaseSucceeded(db, purchase.id, paidAt);
  return purchase.id;
}

const reserve = (now: Date, userId = space.initiatorId) =>
  reserveSpacePurchase(db, {
    spaceId: space.spaceId,
    userId,
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: "anna@example.ru",
    now,
    reuseSince: new Date(now.getTime() - 30 * 60_000),
  });

beforeEach(async () => {
  db = await createTestDb();
  space = await seedTogetherSpace(db);
});

describe("grantAccessPeriod", () => {
  test("gives a 30-day period starting at the payment time", async () => {
    const purchaseId = await paidPurchase(NOW);

    const outcome = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW });

    expect(outcome).toEqual({ ok: true, created: true, period: { startsAt: NOW, endsAt: days(30) } });
    expect(await hasAccessPeriod(db, purchaseId)).toBe(true);
  });

  test("granting the same purchase again changes nothing", async () => {
    const purchaseId = await paidPurchase(NOW);
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW });

    const again = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: days(5) });

    expect(again).toMatchObject({ ok: true, created: false, period: { startsAt: NOW, endsAt: days(30) } });
    expect(await listAccessPeriods(db, space.spaceId)).toHaveLength(1);
  });

  test("an early payment extends access after the current period without overlap", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    const second = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(days(10)), paidAt: days(10) });

    expect(second).toMatchObject({ ok: true, created: true, period: { startsAt: days(30), endsAt: days(60) } });
  });

  test("a payment after a gap starts at the payment time", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    const late = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(days(45)), paidAt: days(45) });

    expect(late).toMatchObject({ ok: true, period: { startsAt: days(45), endsAt: days(75) } });
  });

  test("gives nothing to a closed space and to an unknown one", async () => {
    const purchaseId = await paidPurchase(NOW);
    await closeSpaceForUser(db, { userId: space.partnerId, now: NOW, reason: "left" });

    expect(await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW })).toEqual({ ok: false, reason: "space_closed" });
    expect(await grantAccessPeriod(db, { spaceId: "00000000-0000-4000-8000-000000000001", purchaseId, paidAt: NOW })).toEqual({ ok: false, reason: "space_not_found" });
    expect(await hasAccessPeriod(db, purchaseId)).toBe(false);
  });
});

describe("getAccessSnapshot", () => {
  test("returns the periods and the closing time", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    expect(await getAccessSnapshot(db, space.spaceId)).toEqual({ periods: [{ startsAt: NOW, endsAt: days(30) }], closedAt: null });

    await closeSpaceForUser(db, { userId: space.initiatorId, now: days(3), reason: "left" });

    expect((await getAccessSnapshot(db, space.spaceId)).closedAt).toEqual(days(3));
  });
});

describe("reserveSpacePurchase", () => {
  test("creates a pending purchase for the space", async () => {
    const outcome = await reserve(NOW);

    expect(outcome.kind).toBe("created");
    if (outcome.kind === "created") {
      expect(outcome.purchase).toMatchObject({ spaceId: space.spaceId, userId: space.initiatorId, product: TOGETHER_PRODUCT, status: "pending", amountKopecks: TOGETHER_PRICE_KOPECKS });
    }
  });

  test("reuses a recent unfinished purchase that already has a payment page, for either member", async () => {
    const first = await reserve(NOW);
    if (first.kind !== "created") throw new Error("expected a created purchase");
    await db.update(purchases).set({ confirmationUrl: "https://pay.example/1" }).where(eq(purchases.id, first.purchase.id));

    const second = await reserve(new Date(NOW.getTime() + 60_000), space.partnerId);

    expect(second.kind).toBe("reused");
    if (second.kind === "reused") expect(second.purchase.id).toBe(first.purchase.id);
  });

  test("is not available when more than 30 days are already paid ahead", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    expect((await reserve(NOW)).kind).toBe("created");
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    expect(await reserve(NOW)).toEqual({ kind: "not_available" });
  });

  test("is not available once the space is closed", async () => {
    await closeSpaceForUser(db, { userId: space.initiatorId, now: NOW, reason: "left" });

    expect(await reserve(NOW)).toEqual({ kind: "not_available" });
  });
});

describe("owner lists", () => {
  test("lists paid purchases that never got access", async () => {
    const granted = await paidPurchase(NOW);
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: granted, paidAt: NOW });
    const orphan = await paidPurchase(days(1));

    expect(await listPaidWithoutAccess(db)).toEqual([
      { purchaseId: orphan, spaceId: space.spaceId, userId: space.initiatorId, paidAt: days(1), amountKopecks: TOGETHER_PRICE_KOPECKS },
    ]);
  });

  test("lists closed spaces that still had paid time left", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    await closeSpaceForUser(db, { userId: space.partnerId, now: days(20), reason: "left" });

    expect(await listClosedWithRemaining(db)).toEqual([{ spaceId: space.spaceId, closedAt: days(20), closedReason: "left", remainingDays: 10 }]);
  });

  test("does not list a closed space whose paid time was used up", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    await closeSpaceForUser(db, { userId: space.partnerId, now: days(31), reason: "left" });

    expect(await listClosedWithRemaining(db)).toEqual([]);
  });
});
