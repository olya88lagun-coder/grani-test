import { beforeEach, describe, expect, test } from "vitest";
import {
  acceptShortPairInvite,
  createPurchase,
  createTestDb,
  deleteUserData,
  getActiveShortPair,
  getLatestShortResult,
  getOrCreateShortPairInvite,
  getPurchase,
  getShortPairForMember,
  getShortPairInviteByToken,
  leaveShortPair,
  listActiveShortPairs,
  listOwnedProducts,
  markPurchaseSucceeded,
  saveShortResult,
  seedUser,
  type Database,
} from "./testing";

let db: Database;
let anna: string;
let boris: string;
const now = new Date("2026-11-08T12:00:00Z");
const attachment = (userId: string, typeKey = "anxious") =>
  saveShortResult(db, { userId, testSlug: "attachment", answers: { an01: 4 }, scores: { anxiety: 70, avoidance: 30 }, typeKey });

async function invite(userId: string) {
  const result = await attachment(userId);
  return getOrCreateShortPairInvite(db, { userId, shortResultId: result.id });
}

async function accept(token: string, partnerUserId: string) {
  const result = await attachment(partnerUserId, "avoidant");
  return acceptShortPairInvite(db, { token, partnerUserId, partnerShortResultId: result.id, consentAt: now, consentVersion: "v1" });
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
  boris = await seedUser(db, { externalId: "boris" });
});

describe("short pair invites", () => {
  test("an open invite is reused for the same result and carries the test slug", async () => {
    const result = await attachment(anna);
    const first = await getOrCreateShortPairInvite(db, { userId: anna, shortResultId: result.id });
    const second = await getOrCreateShortPairInvite(db, { userId: anna, shortResultId: result.id });
    expect(second).toEqual(first);
    const found = await getShortPairInviteByToken(db, first.token);
    expect(found).toMatchObject({ token: first.token, status: "open", testSlug: "attachment", inviterShortResultId: result.id });
    expect(found?.inviter.id).toBe(anna);
    expect(await getShortPairInviteByToken(db, "not-a-token")).toBeNull();
  });

  test("the latest short result of a test is found per user", async () => {
    expect(await getLatestShortResult(db, { userId: anna, testSlug: "attachment" })).toBeNull();
    await attachment(anna, "secure");
    const latest = await attachment(anna, "fearful");
    expect((await getLatestShortResult(db, { userId: anna, testSlug: "attachment" }))?.id).toBe(latest.id);
    expect(await getLatestShortResult(db, { userId: anna, testSlug: "temperament" })).toBeNull();
  });
});

describe("accepting a short pair invite", () => {
  test("creates a pair both members can see with their results", async () => {
    const { token } = await invite(anna);
    const outcome = await accept(token, boris);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    for (const member of [anna, boris]) {
      const pair = await getShortPairForMember(db, outcome.pairId, member);
      expect(pair?.testSlug).toBe("attachment");
      expect(pair?.members.map((m) => [m.user.id, m.result.typeKey])).toEqual([
        [anna, "anxious"],
        [boris, "avoidant"],
      ]);
    }
    const vera = await seedUser(db, { externalId: "vera" });
    expect(await getShortPairForMember(db, outcome.pairId, vera)).toBeNull();
    expect((await getActiveShortPair(db, outcome.pairId))?.id).toBe(outcome.pairId);
  });

  test("rejects the own invite, a used invite and an unknown token", async () => {
    const { token } = await invite(anna);
    expect(await accept(token, anna)).toEqual({ ok: false, reason: "own_invite" });
    expect((await accept(token, boris)).ok).toBe(true);
    const vera = await seedUser(db, { externalId: "vera" });
    expect(await accept(token, vera)).toEqual({ ok: false, reason: "already_used" });
    expect(await accept("x".repeat(20), vera)).toEqual({ ok: false, reason: "not_found" });
  });

  test("two simultaneous accepts create exactly one pair", async () => {
    const { token } = await invite(anna);
    const vera = await seedUser(db, { externalId: "vera" });
    const outcomes = await Promise.all([accept(token, boris), accept(token, vera)]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
  });

  test("rejects a partner result of another test", async () => {
    const { token } = await invite(anna);
    const temperament = await saveShortResult(db, { userId: boris, testSlug: "temperament", answers: {}, scores: {}, typeKey: "sangvinik" });
    expect(await acceptShortPairInvite(db, { token, partnerUserId: boris, partnerShortResultId: temperament.id, consentAt: now, consentVersion: "v1" })).toEqual({
      ok: false,
      reason: "wrong_test",
    });
  });

  test("rejects a second active pair of the same two people in the same test", async () => {
    expect((await accept((await invite(anna)).token, boris)).ok).toBe(true);
    expect(await accept((await invite(anna)).token, boris)).toEqual({ ok: false, reason: "already_paired" });
  });

  test("a pair cannot pair a user with themselves", async () => {
    const a = await attachment(anna);
    const { shortPairs, shortPairInvites } = await import("./schema");
    const [row] = await db.insert(shortPairInvites).values({ token: "t".repeat(24), testSlug: "attachment", inviterUserId: anna, inviterShortResultId: a.id }).returning();
    await expect(
      db.insert(shortPairs).values({ inviteId: row!.id, testSlug: "attachment", userAId: anna, shortResultAId: a.id, userBId: anna, shortResultBId: a.id, partnerConsentAt: now, partnerConsentVersion: "v1" }),
    ).rejects.toThrow();
  });
});

describe("leaving a short pair", () => {
  test("hides the pair from both members", async () => {
    const outcome = await accept((await invite(anna)).token, boris);
    if (!outcome.ok) throw new Error("pair not created");
    expect(await listActiveShortPairs(db, { userId: anna, testSlug: "attachment" })).toHaveLength(1);
    expect(await leaveShortPair(db, outcome.pairId, boris)).toBe(true);
    expect(await leaveShortPair(db, outcome.pairId, boris)).toBe(false);
    for (const member of [anna, boris]) expect(await getShortPairForMember(db, outcome.pairId, member)).toBeNull();
    expect(await getActiveShortPair(db, outcome.pairId)).toBeNull();
    expect(await listActiveShortPairs(db, { userId: anna, testSlug: "attachment" })).toEqual([]);
  });
});

describe("purchases for short pairs", () => {
  test("a purchase targets the pair and is listed as owned once paid", async () => {
    const outcome = await accept((await invite(anna)).token, boris);
    if (!outcome.ok) throw new Error("pair not created");
    const purchase = await createPurchase(db, { userId: boris, product: "attachment_pair", target: { shortPairId: outcome.pairId }, amountKopecks: 34900 });
    expect(purchase).toMatchObject({ shortPairId: outcome.pairId, shortResultId: null, pairId: null });
    expect(await listOwnedProducts(db, { shortPairId: outcome.pairId })).toEqual([]);
    await markPurchaseSucceeded(db, purchase.id, now);
    expect(await listOwnedProducts(db, { shortPairId: outcome.pairId })).toEqual(["attachment_pair"]);
  });

  test("a purchase cannot target a short result and a short pair at once", async () => {
    const outcome = await accept((await invite(anna)).token, boris);
    if (!outcome.ok) throw new Error("pair not created");
    const result = await attachment(anna);
    const { purchases } = await import("./schema");
    await expect(
      db.insert(purchases).values({ userId: anna, product: "attachment_pair", shortResultId: result.id, shortPairId: outcome.pairId, amountKopecks: 34900 }),
    ).rejects.toThrow();
  });

  test("deleting a member removes the pair and the invite but keeps the purchase with a cleared link", async () => {
    const { token } = await invite(anna);
    const outcome = await accept(token, boris);
    if (!outcome.ok) throw new Error("pair not created");
    const purchase = await createPurchase(db, { userId: anna, product: "attachment_pair", target: { shortPairId: outcome.pairId }, amountKopecks: 34900 });
    await markPurchaseSucceeded(db, purchase.id, now);
    await deleteUserData(db, boris);
    expect(await getActiveShortPair(db, outcome.pairId)).toBeNull();
    expect((await getPurchase(db, purchase.id))?.shortPairId ?? null).toBeNull();
    await deleteUserData(db, anna);
    expect(await getShortPairInviteByToken(db, token)).toBeNull();
  });
});
