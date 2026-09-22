import { beforeEach, describe, expect, test } from "vitest";
import {
  getActivePair,
  acceptPairInvite,
  createTestDb,
  getOrCreatePairInvite,
  getPairForMember,
  getPairInviteByToken,
  leavePair,
  listActivePairs,
  seedUserWithResult,
  type Database,
} from "./testing";

const CONSENT_AT = new Date("2026-09-17T12:00:00Z");

let db: Database;
let anna: { userId: string; resultId: string };
let boris: { userId: string; resultId: string };
let vera: { userId: string; resultId: string };

async function invite(from = anna) {
  return getOrCreatePairInvite(db, { userId: from.userId, resultId: from.resultId });
}

async function accept(token: string, by = boris) {
  return acceptPairInvite(db, { token, partnerUserId: by.userId, partnerResultId: by.resultId, consentAt: CONSENT_AT });
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUserWithResult(db, { externalId: "anna", displayName: "Аня", gender: "female" });
  boris = await seedUserWithResult(db, { externalId: "boris", displayName: "Борис", gender: "male" });
  vera = await seedUserWithResult(db, { externalId: "vera", displayName: "Вера" });
});

describe("pair invites", () => {
  test("a result has one open invite until it is accepted", async () => {
    const first = await invite();
    expect(await invite()).toEqual(first);

    await accept(first.token);

    expect((await invite()).token).not.toBe(first.token);
  });

  test("resolves a token to the inviter and status", async () => {
    const { token } = await invite();

    expect(await getPairInviteByToken(db, token)).toMatchObject({ status: "open", inviter: { displayName: "Аня" }, inviterResultId: anna.resultId });
    expect(await getPairInviteByToken(db, "nope")).toBeNull();
  });
});

describe("acceptPairInvite", () => {
  test("creates a pair with both results", async () => {
    const { token } = await invite();

    const outcome = await accept(token);

    const pair = outcome.ok ? await getPairForMember(db, outcome.pairId, boris.userId) : null;
    expect(pair?.members.map((member) => member.user.displayName)).toEqual(["Аня", "Борис"]);
    expect(pair?.members[1].result.id).toBe(boris.resultId);
  });

  test("the inviter cannot accept their own invite", async () => {
    const { token } = await invite();

    expect(await accept(token, anna)).toEqual({ ok: false, reason: "own_invite" });
  });

  test("a link works only once", async () => {
    const { token } = await invite();
    await accept(token);

    expect(await accept(token, vera)).toEqual({ ok: false, reason: "already_used" });
  });

  test("two people have at most one active pair", async () => {
    await accept((await invite()).token);

    expect(await accept((await invite(boris)).token, anna)).toEqual({ ok: false, reason: "already_paired" });
  });

  test("reports an unknown token", async () => {
    expect(await accept("y".repeat(24))).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("membership and leaving", () => {
  test("the worker reads an active pair without being a member, but not a left one", async () => {
    const outcome = await accept((await invite()).token);
    const pairId = outcome.ok ? outcome.pairId : "";

    expect((await getActivePair(db, pairId))?.members.map((member) => member.user.id)).toEqual([anna.userId, boris.userId]);
    await leavePair(db, pairId, anna.userId);
    expect(await getActivePair(db, pairId)).toBeNull();
  });

  test("only members see a pair, and nobody sees it after one leaves", async () => {
    const outcome = await accept((await invite()).token);
    const pairId = outcome.ok ? outcome.pairId : "";

    expect(await getPairForMember(db, pairId, vera.userId)).toBeNull();
    expect(await listActivePairs(db, anna.userId)).toEqual([expect.objectContaining({ id: pairId, partner: expect.objectContaining({ displayName: "Борис" }) })]);

    expect(await leavePair(db, pairId, vera.userId)).toBe(false);
    expect(await leavePair(db, pairId, boris.userId)).toBe(true);

    expect(await getPairForMember(db, pairId, anna.userId)).toBeNull();
    expect(await getPairForMember(db, pairId, boris.userId)).toBeNull();
    expect(await listActivePairs(db, anna.userId)).toEqual([]);
  });

  test("after leaving, the same people can pair again", async () => {
    const first = await accept((await invite()).token);
    await leavePair(db, first.ok ? first.pairId : "", anna.userId);

    expect((await accept((await invite()).token)).ok).toBe(true);
  });
});
