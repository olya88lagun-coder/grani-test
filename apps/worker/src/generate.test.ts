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
import { fallbackSections, buildPersonalInput, parseSections, type Prompt, type ReportWriter } from "@grani/ai";
import { cardsStubWriter, portraitStubWriter } from "@grani/ai/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runGenerate, type GenerateDeps } from "./generate";

let db: Database;
let deps: GenerateDeps;
let anna: { userId: string; resultId: string };

const CHAPTER_RESULT = { scores: { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 }, typeCode: "++++", stability: "sensitive" } as const;

// Модель, которая отвечает по-старому: одним корректным текстом главы формата 1
function oldFormatWriter(kind: "chapter_money" | "chapter_stress"): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const answer = JSON.stringify(fallbackSections(buildPersonalInput(getLibrary(), kind, CHAPTER_RESULT)));
  return { name: "stub", calls, complete: async (prompt) => (calls.push(prompt), answer) };
}

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

  test("with the pilot flag the money chapter is saved as cards written by the model", async () => {
    deps.writer = cardsStubWriter();
    deps.chapterCardsV2 = true;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "chapter_money");
    expect(report?.source).toBe("ai");
    expect(parseSections("chapter_money", report?.sections)).toMatchObject({ version: 2 });
  });

  test("when a part fails the chapter is built from the library and no model answer is mixed in", async () => {
    deps.writer = cardsStubWriter({ overview: ["{}", "{}", "{}", "{}", "{}"] });
    deps.chapterCardsV2 = true;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "chapter_money");
    expect(report?.source).toBe("fallback");
    expect(parseSections("chapter_money", report?.sections)).toHaveProperty("tips");
  });

  test("without the flag the model is asked once, for the old chapter format", async () => {
    const stub = oldFormatWriter("chapter_money");
    deps.writer = stub;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    expect(stub.calls).toHaveLength(1);
    expect(JSON.parse(stub.calls[0]!.user)).not.toHaveProperty("seeds");
  });

  test("every chapter is written as cards with the flag", async () => {
    for (const kind of ["chapter_conflict", "chapter_stress", "chapter_relationships"] as const) {
      const stub = cardsStubWriter();
      deps.writer = stub;
      deps.chapterCardsV2 = true;

      await runGenerate({ kind, resultId: anna.resultId }, deps);

      expect(stub.calls, kind).toHaveLength(3);
      const report = await getReport(db, { resultId: anna.resultId }, kind);
      expect(report?.source, kind).toBe("ai");
      expect(parseSections(kind, report?.sections), kind).toHaveProperty("situations");
    }
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

describe("chapter bundle", () => {
  test("announces all four chapters with one message when the last one is ready", async () => {
    await payFull();
    const bundle = await createPurchase(db, { userId: anna.userId, product: "chapters_all", target: { resultId: anna.resultId }, amountKopecks: 24900 });
    await markPurchaseSucceeded(db, bundle.id, new Date());

    for (const kind of ["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"] as const) {
      await runGenerate({ kind, resultId: anna.resultId }, deps);
    }

    expect(deps.enqueueNotify).toHaveBeenCalledTimes(1);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "chapters_ready", resultId: anna.resultId });
  });

  test("a single chapter bought on its own is announced by itself", async () => {
    await payFull();
    const single = await createPurchase(db, { userId: anna.userId, product: "chapter_stress", target: { resultId: anna.resultId }, amountKopecks: 9900 });
    await markPurchaseSucceeded(db, single.id, new Date());

    await runGenerate({ kind: "chapter_stress", resultId: anna.resultId }, deps);

    expect(deps.enqueueNotify).toHaveBeenCalledWith(expect.objectContaining({ kind: "report_ready" }));
  });
});

describe("life cards", () => {
  const lifeJob = () => ({ kind: "life" as const, resultId: anna.resultId });

  beforeEach(() => {
    deps.lifeCardsV1 = true;
  });

  test("a paid owner gets five cards written by the model and no announcement", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);

    const report = await getReport(db, { resultId: anna.resultId }, "life");
    expect(report?.source).toBe("ai");
    expect(parseSections("life", report?.sections)?.situations).toHaveLength(5);
    expect(stub.calls).toHaveLength(2);
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("without the flag nothing is asked and nothing is saved", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;
    deps.lifeCardsV1 = false;

    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("without the model nothing is saved: the page keeps the static scenarios", async () => {
    await payFull();
    deps.writer = null;

    await runGenerate(lifeJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("without the paid full report the model is not asked and nothing is saved", async () => {
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("when every attempt fails nothing is saved and the failure is logged without the answer text", async () => {
    await payFull();
    deps.writer = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    await runGenerate(lifeJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("warn", "life cards failed", { kind: "life" });
  });

  test("a second run does not ask the model again", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);
    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(2);
  });
});

describe("portrait blocks", () => {
  const portraitJob = () => ({ kind: "portrait" as const, resultId: anna.resultId });

  beforeEach(() => {
    deps.portraitV1 = true;
  });

  test("a paid owner gets a headline and five blocks written by the model, with no announcement", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;

    await runGenerate(portraitJob(), deps);

    const report = await getReport(db, { resultId: anna.resultId }, "portrait");
    expect(report?.source).toBe("ai");
    expect(parseSections("portrait", report?.sections)?.blocks).toHaveLength(5);
    expect(stub.calls).toHaveLength(1);
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("without the flag nothing is asked and nothing is saved, and the life flag does not enable it", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;
    deps.portraitV1 = false;
    deps.lifeCardsV1 = true;

    await runGenerate(portraitJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();
  });

  test("without the model or without the paid full report nothing is saved", async () => {
    await payFull();
    deps.writer = null;
    await runGenerate(portraitJob(), deps);
    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();

    const other = await seedUserWithResult(db, { externalId: "boris" });
    const stub = portraitStubWriter();
    deps.writer = stub;
    await runGenerate({ kind: "portrait", resultId: other.resultId }, deps);
    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: other.resultId }, "portrait")).toBeNull();
  });

  test("when every attempt fails nothing is saved and the failure is logged without the answer text", async () => {
    await payFull();
    deps.writer = portraitStubWriter(["{}", "{}", "{}", "{}", "{}"]);

    await runGenerate(portraitJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("warn", "portrait failed", { kind: "portrait" });
  });

  test("a second run does not ask the model again", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;

    await runGenerate(portraitJob(), deps);
    await runGenerate(portraitJob(), deps);

    expect(stub.calls).toHaveLength(1);
  });
});
