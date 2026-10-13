import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, getReport, getReportById, listReports, saveReport, seedPair, seedUserWithResult, type Database } from "./testing";

let db: Database;
let resultId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ resultId } = await seedUserWithResult(db, { externalId: "anna" }));
});

describe("saveReport", () => {
  test("stores a report once per result and kind", async () => {
    const first = await saveReport(db, { target: { resultId }, kind: "full", sections: { portrait: "a" }, source: "ai" });
    const second = await saveReport(db, { target: { resultId }, kind: "full", sections: { portrait: "b" }, source: "fallback" });

    expect(first.created).toBe(true);
    expect(second).toEqual({ report: first.report, created: false });
    expect((await getReport(db, { resultId }, "full"))?.sections).toEqual({ portrait: "a" });
  });

  test("stores the life cards beside the other reports of a result", async () => {
    await saveReport(db, { target: { resultId }, kind: "full", sections: {}, source: "ai" });
    const life = await saveReport(db, { target: { resultId }, kind: "life", sections: { version: 1 }, source: "ai" });

    expect(life.created).toBe(true);
    expect((await getReport(db, { resultId }, "life"))?.sections).toEqual({ version: 1 });
    expect((await listReports(db, { resultId })).map((report) => report.kind).sort()).toEqual(["full", "life"]);
  });

  test("keeps different kinds apart and lists them", async () => {
    await saveReport(db, { target: { resultId }, kind: "full", sections: {}, source: "ai" });
    await saveReport(db, { target: { resultId }, kind: "chapter_money", sections: {}, source: "fallback" });

    expect((await listReports(db, { resultId })).map((report) => report.kind).sort()).toEqual(["chapter_money", "full"]);
    expect(await getReport(db, { resultId }, "friends")).toBeNull();
  });

  test("a pair report belongs to the pair", async () => {
    const { pairId } = await seedPair(db);

    const { report } = await saveReport(db, { target: { pairId }, kind: "pair", sections: { similar: "x" }, source: "ai" });

    expect(report).toMatchObject({ pairId, resultId: null, kind: "pair" });
    expect(await getReportById(db, report.id)).toEqual(report);
    expect(await getReportById(db, "not-a-uuid")).toBeNull();
    expect(await listReports(db, { pairId: "not-a-uuid" })).toEqual([]);
  });
});
