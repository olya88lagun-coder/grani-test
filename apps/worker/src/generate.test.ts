import { FRIEND_ITEMS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import {
  addFriendResponse,
  createPurchase,
  createTestDb,
  getOrCreateInvite,
  getReport,
  leavePair,
  markPurchaseSucceeded,
  seedPair,
  seedUserWithResult,
  type Database,
} from "@grani/db/testing";
import { fallbackSections, buildPersonalInput } from "@grani/ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runGenerate, type GenerateDeps } from "./generate";

let db: Database;
let deps: GenerateDeps;
let anna: { userId: string; resultId: string };

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, library: getLibrary(), writer: null, log: vi.fn(), enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  anna = await seedUserWithResult(db, { externalId: "anna" });
});

async function payFull() {
  const purchase = await createPurchase(db, { userId: anna.userId, product: "full", target: { resultId: anna.resultId }, amountKopecks: 29900 });
  await markPurchaseSucceeded(db, purchase.id, new Date());
}

describe("runGenerate", () => {
  test("builds the full report once and announces it once", async () => {
    await runGenerate({ kind: "full", resultId: anna.resultId }, deps);
    await runGenerate({ kind: "full", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "full");
    expect(report?.source).toBe("fallback");
    expect(deps.enqueueNotify).toHaveBeenCalledTimes(1);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "report_ready", reportId: report!.id });
  });

  test("uses the model when it answers well", async () => {
    const result = { scores: { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 }, typeCode: "++++", stability: "sensitive" } as const;
    const good = JSON.stringify(fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", result)));
    deps.writer = { name: "stub", complete: vi.fn().mockResolvedValue(good) };

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    expect((await getReport(db, { resultId: anna.resultId }, "chapter_money"))?.source).toBe("ai");
  });

  test("the friends section waits for the paid full report and three friends", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, anna.resultId);
    const answers = Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, 4 as const]));
    for (const device of ["a", "b", "c"]) await addFriendResponse(db, { inviteId, answers, deviceHash: device });

    await runGenerate({ kind: "friends", resultId: anna.resultId }, deps);
    expect(await getReport(db, { resultId: anna.resultId }, "friends")).toBeNull();

    await payFull();
    await runGenerate({ kind: "friends", resultId: anna.resultId }, deps);
    expect(await getReport(db, { resultId: anna.resultId }, "friends")).not.toBeNull();
  });

  test("the pair report is built for an active pair and skipped after leaving", async () => {
    const active = await seedPair(db);
    const left = await seedPair(db);
    await leavePair(db, left.pairId, left.a.userId);

    await runGenerate({ kind: "pair", pairId: active.pairId }, deps);
    await runGenerate({ kind: "pair", pairId: left.pairId }, deps);

    expect(await getReport(db, { pairId: active.pairId }, "pair")).not.toBeNull();
    expect(await getReport(db, { pairId: left.pairId }, "pair")).toBeNull();
  });

  test("an unknown result is skipped", async () => {
    await runGenerate({ kind: "full", resultId: "00000000-0000-0000-0000-000000000000" }, deps);

    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });
});
