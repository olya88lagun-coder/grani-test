import { FRIEND_ITEMS } from "@grani/content";
import type { Answers } from "@grani/core";
import { countFriendResponses, createTestDb, getInviteForResult, seedUserWithResult, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { newDeviceId } from "./device";
import {
  createInviteForOwner,
  firstName,
  getFriendPage,
  getFriendsSummary,
  parseFriendAnswers,
  submitFriendAnswers,
  type FriendsDeps,
} from "./friends-service";

const SECRET = "s".repeat(40);
const friendAnswers = (value: number) => Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, value])) as Answers;

let db: Database;
let deps: FriendsDeps;
let owner: { userId: string; resultId: string };
let token: string;

async function answer(value: number, deviceId = newDeviceId(), viewerUserId: string | null = null) {
  return submitFriendAnswers(deps, { token, raw: friendAnswers(value), deviceId, viewerUserId });
}

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, secret: SECRET, enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  owner = await seedUserWithResult(db, { externalId: "owner", displayName: "Аня Петрова", gender: "female" });
  token = (await createInviteForOwner(db, owner))!;
});

describe("parseFriendAnswers", () => {
  test("accepts exactly the 20 friend questions with answers 1–5", () => {
    expect(parseFriendAnswers(friendAnswers(4))).toEqual(friendAnswers(4));
  });

  test.each([
    ["a missing answer", Object.fromEntries(FRIEND_ITEMS.slice(1).map((item) => [item.id, 3]))],
    ["a self-test question", { ...friendAnswers(3), "ipip-05": 3 }],
    ["a value out of range", { ...friendAnswers(3), "ipip-01": 0 }],
    ["not an object", "5"],
  ])("rejects %s", (_, raw) => {
    expect(parseFriendAnswers(raw)).toBeNull();
  });
});

describe("firstName", () => {
  test("keeps only the first word", () => {
    expect(firstName("Аня Петрова")).toBe("Аня");
    expect(firstName("  Борис ")).toBe("Борис");
    expect(firstName("")).toBe("Друг");
  });
});

describe("createInviteForOwner", () => {
  test("creates the link only for the owner of the result", async () => {
    const stranger = await seedUserWithResult(db, { externalId: "stranger" });

    expect(await createInviteForOwner(db, owner)).toBe(token);
    expect(await createInviteForOwner(db, { userId: stranger.userId, resultId: owner.resultId })).toBeNull();
  });
});

describe("getFriendPage", () => {
  test("shows the owner's first name and questions about them", async () => {
    const page = await getFriendPage(db, token);

    expect(page).toMatchObject({ token, ownerFirstName: "Аня", ownerGender: "female" });
    expect(page?.items).toHaveLength(20);
    expect(page?.items[0]?.text).toContain("Аня");
    expect(JSON.stringify(page)).not.toContain("scores");
  });

  test("returns null for a broken link", async () => {
    expect(await getFriendPage(db, "z".repeat(24))).toBeNull();
  });
});

describe("submitFriendAnswers", () => {
  test("stores an answer and enqueues a notification with the new count", async () => {
    const outcome = await answer(4);

    expect(outcome).toEqual({ kind: "added", friendsCount: 1 });
    const invite = await getInviteForResult(db, owner.resultId);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "friend_answered", inviteId: invite?.id, friendsCount: 1 });
  });

  test("accepts one answer per browser", async () => {
    const deviceId = newDeviceId();
    await answer(4, deviceId);

    expect(await answer(2, deviceId)).toEqual({ kind: "duplicate" });
    expect(deps.enqueueNotify).toHaveBeenCalledTimes(1);
  });

  test("does not let the owner answer about themselves", async () => {
    expect(await answer(5, newDeviceId(), owner.userId)).toEqual({ kind: "own_invite" });
  });

  test("rejects invalid answers and unknown links without saving", async () => {
    expect(await submitFriendAnswers(deps, { token, raw: { "ipip-01": 5 }, deviceId: newDeviceId(), viewerUserId: null })).toEqual({ kind: "invalid" });
    expect(await submitFriendAnswers(deps, { token: "q".repeat(24), raw: friendAnswers(3), deviceId: newDeviceId(), viewerUserId: null })).toEqual({ kind: "not_found" });

    const invite = await getInviteForResult(db, owner.resultId);
    expect(await countFriendResponses(db, invite!.id)).toBe(0);
  });

  test("still saves the answer when the queue is down", async () => {
    deps.enqueueNotify = vi.fn().mockRejectedValue(new Error("queue down"));

    expect((await answer(3)).kind).toBe("added");
  });
});

describe("getFriendsSummary", () => {
  test("has no link and nothing to compare before the owner shares it", async () => {
    const other = await seedUserWithResult(db, { externalId: "other" });

    expect(await getFriendsSummary(db, other.resultId)).toEqual({ inviteToken: null, friendsCount: 0, needed: 3, comparison: null });
  });

  test("hides the comparison until three friends answered", async () => {
    await answer(5);
    await answer(5);

    expect(await getFriendsSummary(db, owner.resultId)).toEqual({ inviteToken: token, friendsCount: 2, needed: 1, comparison: null });
  });

  test("compares the owner and the friends on the same 20 questions", async () => {
    // У владельца все ответы «3» → 50 по каждой черте. Друзья отвечают «5»: в каждой четвёрке 2 прямых и 2 обратных
    // вопроса, поэтому тоже 50 — разницы нет
    await answer(5);
    await answer(5);
    await answer(5);

    const summary = await getFriendsSummary(db, owner.resultId);

    expect(summary.friendsCount).toBe(3);
    expect(summary.needed).toBe(0);
    expect(summary.comparison?.traits.extraversion).toEqual({ self: 50, friends: 50, diff: 0, notable: false });
  });
});
