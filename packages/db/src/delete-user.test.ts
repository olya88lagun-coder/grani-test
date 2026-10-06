import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteUserData } from "./delete-user";
import { authIdentities, friendResponses, invites, pairInvites, pairs, purchases, reports, results, togetherAnswers, togetherCards, togetherSpaces, users } from "./schema";
import { createTestDb, seedPair, seedTogetherSpace, seedUserWithResult } from "./testing";
import { createSpace } from "./together";
import type { Database } from "./types";
import { getUser } from "./users";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("deleteUserData", () => {
  it("removes results, friend answers, reports and identities and marks the user deleted", async () => {
    const { userId, resultId } = await seedUserWithResult(db, { externalId: "tg-1", gender: "female" });
    const [invite] = await db.insert(invites).values({ resultId, token: "t1" }).returning();
    await db.insert(friendResponses).values({ inviteId: invite!.id, answers: { "friend-01": 3 }, deviceHash: "d1" });
    await db.insert(reports).values({ resultId, kind: "full", sections: {}, source: "fallback" });

    const outcome = await deleteUserData(db, userId);

    expect(outcome).toEqual({ deleted: true });
    expect(await db.select().from(results).where(eq(results.userId, userId))).toEqual([]);
    expect(await db.select().from(invites)).toEqual([]);
    expect(await db.select().from(friendResponses)).toEqual([]);
    expect(await db.select().from(reports)).toEqual([]);
    expect(await db.select().from(authIdentities).where(eq(authIdentities.userId, userId))).toEqual([]);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user!.deletedAt).toBeInstanceOf(Date);
    expect(user!.gender).toBeNull();
    expect(await getUser(db, userId)).toBeNull();
  });

  it("keeps purchases for tax records but detaches them from the result", async () => {
    const { userId, resultId } = await seedUserWithResult(db, { externalId: "tg-2" });
    await db.insert(purchases).values({ userId, product: "full", resultId, amountKopecks: 29900, status: "succeeded", receiptEmail: "anna@example.ru" });

    await deleteUserData(db, userId);

    const [purchase] = await db.select().from(purchases);
    expect(purchase).toMatchObject({ userId, product: "full", amountKopecks: 29900, status: "succeeded", resultId: null, receiptEmail: null });
  });

  it("removes the pair and the pair report for both partners but keeps the partner", async () => {
    const { pairId, a, b } = await seedPair(db);
    await db.insert(reports).values({ pairId, kind: "pair", sections: {}, source: "fallback" });
    await db.insert(purchases).values({ userId: a.userId, product: "pair", pairId, amountKopecks: 39900, status: "succeeded" });

    await deleteUserData(db, b.userId);

    expect(await db.select().from(pairs)).toEqual([]);
    expect(await db.select().from(pairInvites)).toHaveLength(1);
    expect(await db.select().from(reports)).toEqual([]);
    const [purchase] = await db.select().from(purchases);
    expect(purchase).toMatchObject({ userId: a.userId, pairId: null, status: "succeeded" });
    expect(await getUser(db, a.userId)).not.toBeNull();
    expect(await db.select().from(results).where(eq(results.userId, a.userId))).toHaveLength(1);
  });

  it("removes the pair invites the deleted user sent", async () => {
    const { a } = await seedPair(db);

    await deleteUserData(db, a.userId);

    expect(await db.select().from(pairInvites)).toEqual([]);
    expect(await db.select().from(pairs)).toEqual([]);
  });

  it("lets the same Telegram account sign up again as a new user", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-3" });
    await deleteUserData(db, userId);

    const again = await seedUserWithResult(db, { externalId: "tg-3" });

    expect(again.userId).not.toBe(userId);
  });

  it("does nothing for an unknown or already deleted user", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-4" });
    await deleteUserData(db, userId);

    expect(await deleteUserData(db, userId)).toEqual({ deleted: false });
    expect(await deleteUserData(db, "not-a-uuid")).toEqual({ deleted: false });
    expect(await deleteUserData(db, "0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f")).toEqual({ deleted: false });
  });

  it("closes the together space of the deleted user and frees the partner", async () => {
    const { spaceId, initiatorId, partnerId } = await seedTogetherSpace(db);

    expect(await deleteUserData(db, initiatorId)).toEqual({ deleted: true });

    const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId));
    expect(space).toMatchObject({ status: "closed", closedReason: "account_deleted" });
    expect((await createSpace(db, { userId: partnerId, now: new Date("2026-10-06T10:00:00Z") })).ok).toBe(true);
  });
  it("erases the deleted user's together answers but keeps the partner's", async () => {
    const { spaceId, initiatorId, partnerId } = await seedTogetherSpace(db);
    const [card] = await db
      .insert(togetherCards)
      .values({ spaceId, cardId: "intro-01", position: 1, snapshot: { id: "intro-01", version: 1, kind: "intro", title: "T", estimatedMinutes: 5, prompt: "P", hint: "H", jointAction: "J", skipAllowed: true, fields: [] } })
      .returning({ id: togetherCards.id });
    await db.insert(togetherAnswers).values([
      { cardId: card!.id, spaceId, userId: initiatorId, status: "submitted", fields: { answer: "ушедшего" } },
      { cardId: card!.id, spaceId, userId: partnerId, status: "submitted", fields: { answer: "оставшегося" } },
    ]);

    await deleteUserData(db, initiatorId);

    const rows = await db.select().from(togetherAnswers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: partnerId, fields: { answer: "оставшегося" } });
  });
});
