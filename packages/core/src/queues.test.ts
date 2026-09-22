import { expect, test } from "vitest";
import { generateJobKey, notifyJobKey, QUEUES } from "./queues";

test("notification jobs have stable keys so a job is enqueued once", () => {
  expect(QUEUES.notify).toBe("notify");
  expect(notifyJobKey({ kind: "friend_answered", inviteId: "i1", friendsCount: 3 })).toBe("friend_answered:i1:3");
  expect(notifyJobKey({ kind: "pair_created", pairId: "p1" })).toBe("pair_created:p1");
});

test("generation jobs are keyed by target and kind", () => {
  expect(QUEUES.generate).toBe("generate");
  expect(generateJobKey({ kind: "full", resultId: "r1" })).toBe("generate:r1:full");
  expect(generateJobKey({ kind: "pair", pairId: "p1" })).toBe("generate:p1:pair");
  expect(notifyJobKey({ kind: "report_ready", reportId: "rep1" })).toBe("report_ready:rep1");
});
