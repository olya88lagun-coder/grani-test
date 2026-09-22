import { expect, test } from "vitest";
import { notifyJobKey, QUEUES } from "./queues";

test("notification jobs have stable keys so a job is enqueued once", () => {
  expect(QUEUES.notify).toBe("notify");
  expect(notifyJobKey({ kind: "friend_answered", inviteId: "i1", friendsCount: 3 })).toBe("friend_answered:i1:3");
  expect(notifyJobKey({ kind: "pair_created", pairId: "p1" })).toBe("pair_created:p1");
});
