import { beforeEach, describe, expect, test } from "vitest";
import {
  listIdentityNotices,
  addFriendResponse,
  createTestDb,
  getFriendAnsweredNotice,
  getNotifyTargets,
  getOrCreateInvite,
  seedUserWithResult,
  setCanNotify,
  type Database,
} from "./testing";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("notify targets", () => {
  test("telegram logins can be notified right away, vk only after permission", async () => {
    const tg = await seedUserWithResult(db, { externalId: "111", provider: "telegram" });
    const vk = await seedUserWithResult(db, { externalId: "222", provider: "vk" });

    expect(await getNotifyTargets(db, tg.userId)).toEqual([{ provider: "telegram", externalId: "111" }]);
    expect(await getNotifyTargets(db, vk.userId)).toEqual([]);

    await setCanNotify(db, { provider: "vk", externalId: "222", canNotify: true });
    await setCanNotify(db, { provider: "telegram", externalId: "111", canNotify: false });

    expect(await getNotifyTargets(db, vk.userId)).toEqual([{ provider: "vk", externalId: "222" }]);
    expect(await getNotifyTargets(db, tg.userId)).toEqual([]);
  });
});

describe("getFriendAnsweredNotice", () => {
  test("returns the owner, result and current count", async () => {
    const owner = await seedUserWithResult(db, { externalId: "owner" });
    const { id: inviteId } = await getOrCreateInvite(db, owner.resultId);
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "a" });
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "b" });

    expect(await getFriendAnsweredNotice(db, inviteId)).toEqual({ ownerUserId: owner.userId, resultId: owner.resultId, friendsCount: 2 });
    expect(await getFriendAnsweredNotice(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("listIdentityNotices", () => {
  test("lists every login of the user with its permission", async () => {
    const vk = await seedUserWithResult(db, { externalId: "333", provider: "vk" });

    expect(await listIdentityNotices(db, vk.userId)).toEqual([{ provider: "vk", canNotify: false }]);
    expect(await listIdentityNotices(db, "bad")).toEqual([]);
  });
});
