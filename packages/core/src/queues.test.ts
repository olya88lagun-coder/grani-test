import { expect, test } from "vitest";
import { generateJobKey, notifyJobKey, QUEUES, receiptsReminderWindow } from "./queues";

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

test("the chapter bundle is announced once per result", () => {
  expect(notifyJobKey({ kind: "chapters_ready", resultId: "r1" })).toBe("chapters_ready:r1");
});

test("the receipts reminder is keyed by a ten-minute window, so a burst of payments sends one message", () => {
  const first = receiptsReminderWindow(new Date("2026-10-07T10:03:20Z"));
  const same = receiptsReminderWindow(new Date("2026-10-07T10:09:59Z"));
  const next = receiptsReminderWindow(new Date("2026-10-07T10:10:00Z"));

  expect(first.bucket).toBe(same.bucket);
  expect(next.bucket).toBe(first.bucket + 1);
  expect(notifyJobKey({ kind: "receipts_pending", bucket: first.bucket, ownerUserId: "u1" })).toBe(`receipts_pending:${first.bucket}`);
});

test("the reminder is delayed to the end of its window so it also counts payments that arrive in between", () => {
  expect(receiptsReminderWindow(new Date("2026-10-07T10:03:20Z")).delaySeconds).toBe(400);
  expect(receiptsReminderWindow(new Date("2026-10-07T10:09:59.500Z")).delaySeconds).toBe(1);
  // Ровно на границе окна задача уходит в следующее окно: ждём целое окно, а не ноль секунд
  expect(receiptsReminderWindow(new Date("2026-10-07T10:10:00Z")).delaySeconds).toBe(600);
});
