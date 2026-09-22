import { compatibilityScore, type TraitScores } from "@grani/core";
import {
  acceptPairInvite,
  addFriendResponse,
  createTestDb,
  getNotifyTargets,
  getOrCreateInvite,
  getOrCreatePairInvite,
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
