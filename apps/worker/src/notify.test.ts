import { compatibilityScore, type TraitScores } from "@grani/core";
import {
  acceptPairInvite,
  addFriendResponse,
  createPurchase,
  createTestDb,
  getNotifyTargets,
  getOrCreateInvite,
  getOrCreatePairInvite,
  leavePair,
  markPurchaseSucceeded,
  saveReport,
  seedPair,
  seedUserWithResult,
  setCanNotify,
  type Database,
} from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runNotify, type NotifyDeps } from "./notify";
import type { Sender } from "./senders";

const APP_URL = "https://grani-test.ru";
const A: TraitScores = { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 55 };
const B: TraitScores = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

let db: Database;
let telegram: ReturnType<typeof vi.fn<Sender>>;
let vk: ReturnType<typeof vi.fn<Sender>>;
let deps: NotifyDeps;

beforeEach(async () => {
  db = await createTestDb();
  telegram = vi.fn<Sender>().mockResolvedValue("sent");
  vk = vi.fn<Sender>().mockResolvedValue("sent");
  deps = { db, senders: { telegram, vk }, appUrl: APP_URL, log: vi.fn() };
});

describe("friend_answered", () => {
  test("tells the owner the current count with a link to the result", async () => {
    const owner = await seedUserWithResult(db, { externalId: "100" });
    const { id: inviteId } = await getOrCreateInvite(db, owner.resultId);
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "a" });

    await runNotify({ kind: "friend_answered", inviteId, friendsCount: 1 }, deps);

    expect(telegram).toHaveBeenCalledWith("100", expect.stringContaining(`1 из 3`));
    expect(telegram.mock.calls[0]?.[1]).toContain(`${APP_URL}/result/${owner.resultId}`);
  });

  test("does nothing for a deleted invite", async () => {
    await runNotify({ kind: "friend_answered", inviteId: "00000000-0000-0000-0000-000000000000", friendsCount: 1 }, deps);

    expect(telegram).not.toHaveBeenCalled();
  });
});

describe("pair_created", () => {
  async function createPair() {
    const anna = await seedUserWithResult(db, { externalId: "201", displayName: "Аня Петрова", scores: A });
    const boris = await seedUserWithResult(db, { externalId: "202", provider: "vk", displayName: "Борис", scores: B });
    await setCanNotify(db, { provider: "vk", externalId: "202", canNotify: true });
    const { token } = await getOrCreatePairInvite(db, anna);
    const outcome = await acceptPairInvite(db, { token, partnerUserId: boris.userId, partnerResultId: boris.resultId, consentAt: new Date() });
    if (!outcome.ok) throw new Error("pair was not created");
    return { anna, boris, pairId: outcome.pairId };
  }

  test("tells both members with the partner's name and the score", async () => {
    const { pairId } = await createPair();
    const score = compatibilityScore(A, B);

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(telegram).toHaveBeenCalledWith("201", `Пара готова: вы и Борис, совместимость ${score}%. Посмотреть типы и шкалы рядом: ${APP_URL}/pair/${pairId}`);
    expect(vk).toHaveBeenCalledWith("202", expect.stringContaining("вы и Аня,"));
  });

  test("stops notifying an address the platform refused", async () => {
    const { anna, pairId } = await createPair();
    telegram.mockResolvedValue("rejected");

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(await getNotifyTargets(db, anna.userId)).toEqual([]);
  });

  test("asks for a retry only when nothing was delivered because of a temporary error", async () => {
    const { pairId } = await createPair();
    telegram.mockResolvedValue("failed");
    vk.mockResolvedValue("failed");

    await expect(runNotify({ kind: "pair_created", pairId }, deps)).rejects.toThrow(/retry/);
  });

  test("does not retry when one member already got the message", async () => {
    const { pairId } = await createPair();
    telegram.mockResolvedValue("failed");

    await expect(runNotify({ kind: "pair_created", pairId }, deps)).resolves.toBeUndefined();
  });

  test("skips providers without a configured sender", async () => {
    const { pairId } = await createPair();
    deps.senders = { vk };

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(vk).toHaveBeenCalledTimes(1);
  });
});

describe("report_ready", () => {
  test("tells the owner that the personal report is ready", async () => {
    const owner = await seedUserWithResult(db, { externalId: "300" });
    const { report } = await saveReport(db, { target: { resultId: owner.resultId }, kind: "full", sections: {}, source: "fallback" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);

    expect(telegram).toHaveBeenCalledWith("300", `Готово: полный разбор. Открыть: ${APP_URL}/report/${owner.resultId}`);
  });

  test("tells both members about the pair report, nobody after leaving", async () => {
    const pair = await seedPair(db);
    const { report } = await saveReport(db, { target: { pairId: pair.pairId }, kind: "pair", sections: {}, source: "fallback" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);
    expect(telegram).toHaveBeenCalledTimes(2);

    telegram.mockClear();
    await leavePair(db, pair.pairId, pair.a.userId);
    await runNotify({ kind: "report_ready", reportId: report.id }, deps);
    expect(telegram).not.toHaveBeenCalled();
  });
});

describe("chapters_ready", () => {
  test("tells the owner once that all four chapters are ready", async () => {
    const owner = await seedUserWithResult(db, { externalId: "400" });

    await runNotify({ kind: "chapters_ready", resultId: owner.resultId }, deps);

    expect(telegram).toHaveBeenCalledWith("400", `Готово: все четыре главы. Открыть: ${APP_URL}/report/${owner.resultId}`);
  });
});

describe("receipts_pending", () => {
  async function paid(buyer: { userId: string; resultId: string }, amountKopecks: number, email: string | null = "buyer@example.ru") {
    const purchase = await createPurchase(db, { userId: buyer.userId, product: "full", target: { resultId: buyer.resultId }, amountKopecks, receiptEmail: email });
    await markPurchaseSucceeded(db, purchase.id, new Date("2026-10-07T10:00:00Z"));
  }

  async function owner() {
    const seeded = await seedUserWithResult(db, { externalId: "900", provider: "vk", displayName: "Владелица" });
    await setCanNotify(db, { provider: "vk", externalId: "900", canNotify: true });
    return seeded;
  }

  test("sends the owner one message with the count and the sum of receipts to send, and no buyer data", async () => {
    const { userId: ownerUserId } = await owner();
    const buyer = await seedUserWithResult(db, { externalId: "901" });
    await paid(buyer, 39_900, "private-buyer@example.ru");
    await paid(buyer, 39_900);

    await runNotify({ kind: "receipts_pending", bucket: 1, ownerUserId }, deps);

    expect(vk).toHaveBeenCalledTimes(1);
    const text = vk.mock.calls[0]?.[1] ?? "";
    expect(text).toContain("Чеков к отправке: 2");
    expect(text).toContain("798");
    expect(text).toContain(`${APP_URL}/admin/receipts`);
    expect(text).not.toContain("private-buyer");
  });

  test("says nothing when there is nothing to send, and ignores free purchases", async () => {
    const seededOwner = await owner();
    const ownerUserId = seededOwner.userId;
    await runNotify({ kind: "receipts_pending", bucket: 1, ownerUserId }, deps);
    await paid(seededOwner, 0, null);

    await runNotify({ kind: "receipts_pending", bucket: 2, ownerUserId }, deps);

    expect(vk).not.toHaveBeenCalled();
  });

  test("does not fail when the owner has not allowed messages, and asks for a retry when delivery fails", async () => {
    const buyer = await seedUserWithResult(db, { externalId: "902" });
    await paid(buyer, 39_900);
    const silent = await seedUserWithResult(db, { externalId: "903", provider: "vk" });

    await expect(runNotify({ kind: "receipts_pending", bucket: 1, ownerUserId: silent.userId }, deps)).resolves.toBeUndefined();

    const { userId: ownerUserId } = await owner();
    vk.mockResolvedValue("failed");
    await expect(runNotify({ kind: "receipts_pending", bucket: 1, ownerUserId }, deps)).rejects.toThrow(/not delivered/);
  });
});
