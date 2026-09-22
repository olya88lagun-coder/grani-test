import { createTestDb, getPairForMember, getUser, seedUserWithResult, upsertUserFromIdentity, type Database, type UserRecord } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { acceptPair, createPairInviteForOwner, getPairInvitePage, pairReturnPath, type PairsDeps } from "./pairs-service";

const NOW = new Date("2026-09-17T12:00:00Z");

let db: Database;
let deps: PairsDeps;
let anna: { userId: string; resultId: string };
let boris: { userId: string; resultId: string };
let token: string;

const user = async (id: string) => (await getUser(db, id)) as UserRecord;

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, now: () => NOW, enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  anna = await seedUserWithResult(db, { externalId: "anna", displayName: "Аня Петрова", gender: "female" });
  boris = await seedUserWithResult(db, { externalId: "boris", displayName: "Борис" });
  token = (await createPairInviteForOwner(db, anna))!;
});

describe("createPairInviteForOwner", () => {
  test("only the owner of the result can invite", async () => {
    expect(await createPairInviteForOwner(db, anna)).toBe(token);
    expect(await createPairInviteForOwner(db, { userId: boris.userId, resultId: anna.resultId })).toBeNull();
  });
});

describe("getPairInvitePage", () => {
  test("guides an anonymous visitor to log in", async () => {
    expect(await getPairInvitePage(db, token, null)).toEqual({ state: "needs_login", inviterFirstName: "Аня", token });
  });

  test("asks a signed-in partner without a result to take the test", async () => {
    const created = await upsertUserFromIdentity(db, { provider: "vk", externalId: "new", displayName: "Вера", gender: null }, { version: "v", at: NOW });
    const vera = created.ok ? created.user : null;

    expect((await getPairInvitePage(db, token, vera))?.state).toBe("needs_result");
  });

  test("shows the consent step to a partner with a result", async () => {
    expect(await getPairInvitePage(db, token, await user(boris.userId))).toEqual({ state: "ready", inviterFirstName: "Аня", inviterGender: "female", token });
  });

  test("tells the inviter it is their own link", async () => {
    expect(await getPairInvitePage(db, token, await user(anna.userId))).toEqual({ state: "own", token });
  });

  test("reports used and unknown links", async () => {
    await acceptPair(deps, { token, userId: boris.userId, consent: true });

    expect(await getPairInvitePage(db, token, null)).toEqual({ state: "used", inviterFirstName: "Аня" });
    expect(await getPairInvitePage(db, "w".repeat(24), null)).toEqual({ state: "not_found" });
  });
});

describe("acceptPair", () => {
  test("does not create a pair without consent", async () => {
    expect(await acceptPair(deps, { token, userId: boris.userId, consent: false })).toEqual({ ok: false, error: "consent_required" });
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("creates a pair with the partner's latest result and notifies both", async () => {
    const outcome = await acceptPair(deps, { token, userId: boris.userId, consent: true });

    expect(outcome.ok).toBe(true);
    const pairId = outcome.ok ? outcome.pairId : "";
    expect((await getPairForMember(db, pairId, anna.userId))?.members[1].result.id).toBe(boris.resultId);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "pair_created", pairId });
  });

  test("needs a result from the partner", async () => {
    const created = await upsertUserFromIdentity(db, { provider: "vk", externalId: "nores", displayName: "Гена", gender: null }, { version: "v", at: NOW });

    expect(await acceptPair(deps, { token, userId: created.ok ? created.user.id : "", consent: true })).toEqual({ ok: false, error: "no_result" });
  });

  test("passes through repository refusals", async () => {
    expect(await acceptPair(deps, { token, userId: anna.userId, consent: true })).toEqual({ ok: false, error: "own_invite" });
    await acceptPair(deps, { token, userId: boris.userId, consent: true });
    expect(await acceptPair(deps, { token, userId: boris.userId, consent: true })).toEqual({ ok: false, error: "already_used" });
  });

  test("keeps the pair when the queue is down", async () => {
    deps.enqueueNotify = vi.fn().mockRejectedValue(new Error("queue down"));

    expect((await acceptPair(deps, { token, userId: boris.userId, consent: true })).ok).toBe(true);
  });
});

describe("pairReturnPath", () => {
  test("returns to the invite only for a well-formed token", () => {
    expect(pairReturnPath(token)).toBe(`/p/${token}`);
    expect(pairReturnPath("../../evil")).toBeNull();
    expect(pairReturnPath(null)).toBeNull();
    expect(pairReturnPath(undefined)).toBeNull();
  });
});
