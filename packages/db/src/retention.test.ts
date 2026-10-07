import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { purchases, results, togetherAccessPeriods, users } from "./schema";
import { createTestDb, seedTogetherAccess, seedTogetherSpace, seedUser, seedUserWithResult } from "./testing";
import { purgeExpiredData, retentionCutoff } from "./retention";
import { closeSpaceForUser } from "./together";
import { getClosedNotice } from "./together-notices";
import { upsertUserFromIdentity } from "./users";
import type { Database } from "./types";

const NOW = new Date("2026-10-07T10:00:00Z");
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const FOUR_YEARS = 4 * 365;

let db: Database;

const setLastLogin = (userId: string, at: Date) => db.update(users).set({ lastLoginAt: at }).where(eq(users.id, userId));
const userRow = async (userId: string) => (await db.select().from(users).where(eq(users.id, userId)))[0]!;
const addPurchase = async (userId: string, paidAt: Date, extra: Partial<typeof purchases.$inferInsert> = {}) => {
  const [row] = await db
    .insert(purchases)
    .values({ userId, product: "full", amountKopecks: 29_900, status: "succeeded", paidAt, createdAt: paidAt, ...extra })
    .returning({ id: purchases.id });
  return row!.id;
};
const purchaseIds = async () => (await db.select({ id: purchases.id }).from(purchases)).map((row) => row.id);

beforeEach(async () => {
  db = await createTestDb();
});

describe("retentionCutoff", () => {
  test("is exactly three calendar years before now", () => {
    expect(retentionCutoff(NOW).toISOString()).toBe("2023-10-07T10:00:00.000Z");
  });
});

describe("purgeExpiredData: accounts", () => {
  test("erases the data of a person who has not logged in for over three years", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "old" });
    await setLastLogin(userId, daysAgo(FOUR_YEARS));

    const outcome = await purgeExpiredData(db, { now: NOW });

    expect(outcome.usersDeleted).toBe(1);
    expect((await userRow(userId)).deletedAt).not.toBeNull();
    expect(await db.select().from(results).where(eq(results.userId, userId))).toHaveLength(0);
  });

  test("keeps a person who logged in just under three years ago", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "recent" });
    await setLastLogin(userId, daysAgo(3 * 365 - 5));

    const outcome = await purgeExpiredData(db, { now: NOW });

    expect(outcome.usersDeleted).toBe(0);
    expect((await userRow(userId)).deletedAt).toBeNull();
    expect(await db.select().from(results).where(eq(results.userId, userId))).toHaveLength(1);
  });

  test("does not touch people who are already deleted", async () => {
    const userId = await seedUser(db, { externalId: "gone" });
    const deletedAt = daysAgo(10);
    await db.update(users).set({ deletedAt, lastLoginAt: daysAgo(FOUR_YEARS) }).where(eq(users.id, userId));

    const outcome = await purgeExpiredData(db, { now: NOW });

    expect(outcome.usersDeleted).toBe(0);
    expect((await userRow(userId)).deletedAt?.toISOString()).toBe(deletedAt.toISOString());
  });

  test("closes the shared space of an erased person so the partner learns why", async () => {
    const { spaceId, initiatorId, partnerId } = await seedTogetherSpace(db, { now: daysAgo(FOUR_YEARS) });
    await setLastLogin(initiatorId, daysAgo(FOUR_YEARS));

    await purgeExpiredData(db, { now: NOW });

    expect(await getClosedNotice(db, { userId: partnerId, now: NOW })).toMatchObject({ spaceId, reason: "account_deleted" });
  });

  test("handles at most the batch size per run and finishes the rest on the next one", async () => {
    for (const name of ["a", "b", "c"]) {
      const id = await seedUser(db, { externalId: name });
      await setLastLogin(id, daysAgo(FOUR_YEARS));
    }

    expect((await purgeExpiredData(db, { now: NOW, batchSize: 2 })).usersDeleted).toBe(2);
    expect((await purgeExpiredData(db, { now: NOW, batchSize: 2 })).usersDeleted).toBe(1);
    expect((await purgeExpiredData(db, { now: NOW, batchSize: 2 })).usersDeleted).toBe(0);
  });
});

describe("purgeExpiredData: payment records", () => {
  test("removes old payment records of deleted people and keeps recent ones", async () => {
    const userId = await seedUser(db, { externalId: "payer" });
    const oldId = await addPurchase(userId, daysAgo(FOUR_YEARS));
    const freshId = await addPurchase(userId, daysAgo(100));
    await db.update(users).set({ deletedAt: daysAgo(50) }).where(eq(users.id, userId));

    const outcome = await purgeExpiredData(db, { now: NOW });

    expect(outcome.purchasesDeleted).toBe(1);
    expect(await purchaseIds()).toEqual([freshId]);
    expect(await purchaseIds()).not.toContain(oldId);
  });

  test("dates an unpaid record by its creation", async () => {
    const userId = await seedUser(db, { externalId: "abandoned" });
    await addPurchase(userId, daysAgo(FOUR_YEARS), { status: "canceled", paidAt: null });
    await db.update(users).set({ deletedAt: daysAgo(50) }).where(eq(users.id, userId));

    expect((await purgeExpiredData(db, { now: NOW })).purchasesDeleted).toBe(1);
  });

  test("keeps old payment records of people who still use the site, so paid access is not lost", async () => {
    const userId = await seedUser(db, { externalId: "active" });
    const id = await addPurchase(userId, daysAgo(FOUR_YEARS));
    await setLastLogin(userId, daysAgo(10));

    expect((await purgeExpiredData(db, { now: NOW })).purchasesDeleted).toBe(0);
    expect(await purchaseIds()).toEqual([id]);
  });

  test("keeps a record that still gives a live shared space its access", async () => {
    const { spaceId, initiatorId } = await seedTogetherSpace(db, { now: daysAgo(FOUR_YEARS) });
    await seedTogetherAccess(db, { spaceId, userId: initiatorId, paidAt: daysAgo(FOUR_YEARS) });
    await db.update(users).set({ deletedAt: daysAgo(50) }).where(eq(users.id, initiatorId));

    expect((await purgeExpiredData(db, { now: NOW })).purchasesDeleted).toBe(0);
    expect(await db.select().from(togetherAccessPeriods)).toHaveLength(1);
  });

  test("removes a record together with its access period once the shared space is closed", async () => {
    const { spaceId, initiatorId } = await seedTogetherSpace(db, { now: daysAgo(FOUR_YEARS) });
    await seedTogetherAccess(db, { spaceId, userId: initiatorId, paidAt: daysAgo(FOUR_YEARS) });
    await closeSpaceForUser(db, { userId: initiatorId, now: daysAgo(FOUR_YEARS - 40), reason: "left" });
    await db.update(users).set({ deletedAt: daysAgo(50) }).where(eq(users.id, initiatorId));

    expect((await purgeExpiredData(db, { now: NOW })).purchasesDeleted).toBe(1);
    expect(await purchaseIds()).toEqual([]);
    expect(await db.select().from(togetherAccessPeriods)).toHaveLength(0);
  });
});

describe("login refreshes the retention clock", () => {
  test("a returning person gets a fresh last login", async () => {
    const userId = await seedUser(db, { externalId: "returning" });
    await setLastLogin(userId, daysAgo(FOUR_YEARS));

    await upsertUserFromIdentity(db, { provider: "telegram", externalId: "returning", displayName: "Вера", gender: null }, null, NOW);

    expect((await userRow(userId)).lastLoginAt.toISOString()).toBe(NOW.toISOString());
    expect((await purgeExpiredData(db, { now: NOW })).usersDeleted).toBe(0);
  });
});
