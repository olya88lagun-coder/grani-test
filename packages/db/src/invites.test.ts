import { beforeEach, describe, expect, test } from "vitest";
import {
  addFriendResponse,
  countFriendResponses,
  createTestDb,
  getInviteByToken,
  getInviteForResult,
  getOrCreateInvite,
  listFriendAnswers,
  seedUserWithResult,
  type Database,
} from "./testing";

let db: Database;
let resultId: string;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ userId, resultId } = await seedUserWithResult(db, { externalId: "owner", displayName: "Аня Петрова", gender: "female" }));
});

describe("invites", () => {
  test("a result has exactly one invite link", async () => {
    expect(await getInviteForResult(db, resultId)).toBeNull();

    const first = await getOrCreateInvite(db, resultId);
    const second = await getOrCreateInvite(db, resultId);

    expect(second).toEqual(first);
    expect(await getInviteForResult(db, resultId)).toEqual(first);
  });

  test("resolves a token to the owner and their answers", async () => {
    const { token } = await getOrCreateInvite(db, resultId);

    const context = await getInviteByToken(db, token);

    expect(context?.owner).toEqual({ id: userId, displayName: "Аня Петрова", gender: "female" });
    expect(context?.resultId).toBe(resultId);
    expect(context?.ownerAnswers["ipip-01"]).toBe(3);
  });

  test("returns null for unknown or malformed tokens", async () => {
    expect(await getInviteByToken(db, "x".repeat(24))).toBeNull();
    expect(await getInviteByToken(db, "bad")).toBeNull();
  });
});

describe("friend responses", () => {
  test("accepts one response per device and counts them", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, resultId);

    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 5 }, deviceHash: "d1" })).toBe("added");
    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 1 }, deviceHash: "d1" })).toBe("duplicate");
    expect(await addFriendResponse(db, { inviteId, answers: { "ipip-01": 2 }, deviceHash: "d2" })).toBe("added");

    expect(await countFriendResponses(db, inviteId)).toBe(2);
    expect(await listFriendAnswers(db, inviteId)).toEqual(expect.arrayContaining([{ "ipip-01": 5 }, { "ipip-01": 2 }]));
  });
});
