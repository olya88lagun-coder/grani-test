import { createTestDb, getNotifyTargets, seedUserWithResult, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { handleVkCallback } from "./vk-callback";

const CONFIG = { groupId: "230000000", callbackSecret: "cb-secret", confirmationCode: "a1b2c3" };
const event = (type: string, object: unknown = {}, overrides: Record<string, unknown> = {}) => ({
  type,
  group_id: 230000000,
  secret: "cb-secret",
  object,
  ...overrides,
});

let db: Database;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ userId } = await seedUserWithResult(db, { externalId: "555", provider: "vk" }));
});

describe("handleVkCallback", () => {
  test("answers the confirmation request with the code", async () => {
    expect(await handleVkCallback(db, CONFIG, event("confirmation"))).toEqual({ status: 200, body: "a1b2c3" });
  });

  test("turns notifications on when the user allows messages or writes to the community", async () => {
    expect(await handleVkCallback(db, CONFIG, event("message_allow", { user_id: 555 }))).toEqual({ status: 200, body: "ok" });
    expect(await getNotifyTargets(db, userId)).toEqual([{ provider: "vk", externalId: "555" }]);

    await handleVkCallback(db, CONFIG, event("message_deny", { user_id: 555 }));
    expect(await getNotifyTargets(db, userId)).toEqual([]);

    await handleVkCallback(db, CONFIG, event("message_new", { message: { from_id: 555, text: "привет" } }));
    expect(await getNotifyTargets(db, userId)).toHaveLength(1);
  });

  test("ignores other events", async () => {
    expect(await handleVkCallback(db, CONFIG, event("wall_post_new", { id: 1 }))).toEqual({ status: 200, body: "ok" });
  });

  test.each([
    ["a wrong secret", event("message_allow", { user_id: 555 }, { secret: "nope" })],
    ["another community", event("message_allow", { user_id: 555 }, { group_id: 1 })],
    ["garbage", "not json"],
  ])("refuses %s without changing anything", async (_, payload) => {
    expect(await handleVkCallback(db, CONFIG, payload)).toEqual({ status: 403, body: "forbidden" });
    expect(await getNotifyTargets(db, userId)).toEqual([]);
  });
});
