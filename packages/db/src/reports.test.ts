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
