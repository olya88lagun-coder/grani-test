import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import {
  closeSpaceForUser,
  createSpace,
  getActiveSpaceForUser,
  getPendingRequest,
  hashInviteToken,
  peekInvite,
  reissueInvite,
  requestJoin,
  respondToRequest,
} from "./together";
import { togetherInvites, togetherSpaces, users } from "./schema";
import { createTestDb, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const AFTER_TTL = new Date(NOW.getTime() + TOGETHER_INVITE_TTL_MS + 1);

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function create(userId = anna) {
  const outcome = await createSpace(db, { userId, now: NOW });
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome;
}

async function makeActive() {
  const { spaceId, token } = await create();
  await requestJoin(db, { token, userId: boris, now: NOW });
  await respondToRequest(db, { userId: anna, accept: true, now: NOW });
  return { spaceId, token };
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("createSpace", () => {
  test("creates a pending space with the creator as initiator and stores only the token hash", async () => {
    const { spaceId, token } = await create();

    const snapshot = await getActiveSpaceForUser(db, anna);
    expect(snapshot?.space).toMatchObject({ id: spaceId, status: "pending" });
    expect(snapshot?.members).toMatchObject([{ userId: anna, role: "initiator", displayName: "Аня" }]);
    const [stored] = await db.select().from(togetherInvites).where(eq(togetherInvites.spaceId, spaceId));
    expect(stored?.tokenHash).toBe(hashInviteToken(token));
    expect(stored?.tokenHash).not.toBe(token);
  });

  test("refuses a second space for the same user, however many times it is asked", async () => {
    await create();

    expect(await createSpace(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await createSpace(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await db.select().from(togetherSpaces)).toHaveLength(1);
  });

  test("lets a user start a new space after leaving the previous one", async () => {
    await create();
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect((await createSpace(db, { userId: anna, now: NOW })).ok).toBe(true);
  });
});

describe("peekInvite", () => {
  test("is valid only for an open, unexpired, known token", async () => {
    const { token } = await create();

    expect(await peekInvite(db, token, NOW)).toBe(true);
    expect(await peekInvite(db, "not-a-token", NOW)).toBe(false);
    expect(await peekInvite(db, "A".repeat(24), NOW)).toBe(false);
    expect(await peekInvite(db, token, AFTER_TTL)).toBe(false);
  });

  test("is not valid once someone has asked to join", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await peekInvite(db, token, NOW)).toBe(false);
  });
});

describe("requestJoin", () => {
  test("moves the invite to requested and is idempotent for the same user", async () => {
    const { token } = await create();

    expect(await requestJoin(db, { token, userId: boris, now: NOW })).toEqual({ ok: true, status: "requested" });
    expect(await requestJoin(db, { token, userId: boris, now: NOW })).toEqual({ ok: true, status: "requested" });
  });

  test("refuses the inviter, someone with a space of their own, expired and unknown links", async () => {
    const { token } = await create();
    await create(vera);

    expect(await requestJoin(db, { token, userId: anna, now: NOW })).toEqual({ ok: false, reason: "own_invite" });
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await requestJoin(db, { token, userId: boris, now: AFTER_TTL })).toEqual({ ok: false, reason: "invalid" });
    expect(await requestJoin(db, { token: "x".repeat(24), userId: boris, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    expect(await requestJoin(db, { token: "short", userId: boris, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  test("a second person gets a neutral refusal while another request waits and after the space is full", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "invalid" });

    await respondToRequest(db, { userId: anna, accept: true, now: NOW });
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("getPendingRequest", () => {
  test("shows the requester to the inviter only while the request is live", async () => {
    const { token } = await create();
    expect(await getPendingRequest(db, { userId: anna, now: NOW })).toBeNull();

    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await getPendingRequest(db, { userId: anna, now: NOW })).toMatchObject({ requesterUserId: boris, displayName: "Борис" });
    expect(await getPendingRequest(db, { userId: boris, now: NOW })).toBeNull();
    expect(await getPendingRequest(db, { userId: anna, now: AFTER_TTL })).toBeNull();
  });
});

describe("respondToRequest", () => {
  test("accepting makes the requester the partner and activates the space", async () => {
    const { spaceId } = await makeActive();

    const snapshot = await getActiveSpaceForUser(db, boris);
    expect(snapshot?.space).toMatchObject({ id: spaceId, status: "active" });
    expect(snapshot?.members.map((m) => [m.role, m.displayName])).toEqual([
      ["initiator", "Аня"],
      ["partner", "Борис"],
    ]);
  });

  test("declining reopens the invite for someone else", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await respondToRequest(db, { userId: anna, accept: false, now: NOW })).toEqual({ ok: true, status: "declined" });
    expect(await getActiveSpaceForUser(db, boris)).toBeNull();
    expect(await peekInvite(db, token, NOW)).toBe(true);
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: true, status: "requested" });
  });

  test("answers no_request without a request, and not_found for someone who is not an initiator", async () => {
    await create();
    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "no_request" });
    expect(await respondToRequest(db, { userId: vera, accept: true, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });

  test("a partner cannot answer requests", async () => {
    await makeActive();

    expect(await respondToRequest(db, { userId: boris, accept: true, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });

  test("does not accept an expired request", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await respondToRequest(db, { userId: anna, accept: true, now: AFTER_TTL })).toEqual({ ok: false, reason: "no_request" });
  });

  test("refuses a requester who has meanwhile started a space of their own, and reopens the invite", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });
    await create(boris);

    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "requester_unavailable" });
    expect(await peekInvite(db, token, NOW)).toBe(true);
  });

  test("refuses a requester whose account was deleted", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });
    await db.update(users).set({ deletedAt: NOW }).where(eq(users.id, boris));

    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "requester_unavailable" });
  });
});

describe("reissueInvite", () => {
  test("revokes the old link and gives a new one while nobody has joined", async () => {
    const { token } = await create();

    const outcome = await reissueInvite(db, { userId: anna, now: NOW });

    expect(outcome.ok).toBe(true);
    expect(await peekInvite(db, token, NOW)).toBe(false);
    expect(await peekInvite(db, outcome.ok ? outcome.token : "", NOW)).toBe(true);
  });

  test("refuses once the space is active and for people without a space", async () => {
    await makeActive();

    expect(await reissueInvite(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "not_pending" });
    expect(await reissueInvite(db, { userId: vera, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("closeSpaceForUser", () => {
  test("closes the space for both, frees both and revokes live invites", async () => {
    const { spaceId } = await makeActive();

    expect(await closeSpaceForUser(db, { userId: boris, now: NOW, reason: "left" })).toEqual({ ok: true, spaceId });

    const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId));
    expect(space).toMatchObject({ status: "closed", closedBy: boris, closedReason: "left", closedAt: NOW });
    expect(await getActiveSpaceForUser(db, anna)).toBeNull();
    expect(await getActiveSpaceForUser(db, boris)).toBeNull();
    expect((await createSpace(db, { userId: anna, now: NOW })).ok).toBe(true);
    expect((await createSpace(db, { userId: boris, now: NOW })).ok).toBe(true);
  });

  test("revokes a waiting link when a pending space is closed", async () => {
    const { token } = await create();

    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect(await peekInvite(db, token, NOW)).toBe(false);
  });

  test("a repeat call and an outsider get not_found", async () => {
    await makeActive();
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect(await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" })).toEqual({ ok: false, reason: "not_found" });
    expect(await closeSpaceForUser(db, { userId: vera, now: NOW, reason: "left" })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("getActiveSpaceForUser", () => {
  test("shows a space only to its own members", async () => {
    await makeActive();

    expect(await getActiveSpaceForUser(db, anna)).not.toBeNull();
    expect(await getActiveSpaceForUser(db, vera)).toBeNull();
    expect(await getActiveSpaceForUser(db, "not-a-uuid")).toBeNull();
  });
});
