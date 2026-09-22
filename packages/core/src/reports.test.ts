import { describe, expect, test } from "vitest";
import { CHAPTER_KINDS, canBuy, friendsReportDue, isReportKind, productTarget, reportKindsFor, unlockedKinds } from "./reports";

describe("reportKindsFor", () => {
  test("a product opens the report of the same name, all chapters open four", () => {
    expect(reportKindsFor("full")).toEqual(["full"]);
    expect(reportKindsFor("chapter_money")).toEqual(["chapter_money"]);
    expect(reportKindsFor("chapters_all")).toEqual(CHAPTER_KINDS);
    expect(reportKindsFor("pair")).toEqual(["pair"]);
  });

  test("only the pair report belongs to a pair", () => {
    expect(productTarget("pair")).toBe("pair");
    expect(productTarget("full")).toBe("result");
    expect(productTarget("chapters_all")).toBe("result");
  });

  test("collects everything the purchases opened", () => {
    expect([...unlockedKinds(["full", "chapters_all"])].sort()).toEqual(["chapter_conflict", "chapter_money", "chapter_relationships", "chapter_stress", "full"]);
  });
});

describe("canBuy", () => {
  test("the full report is bought once", () => {
    expect(canBuy("full", [])).toBe(true);
    expect(canBuy("full", ["full"])).toBe(false);
  });

  test("chapters need the full report", () => {
    expect(canBuy("chapter_money", [])).toBe(false);
    expect(canBuy("chapters_all", [])).toBe(false);
    expect(canBuy("chapter_money", ["full"])).toBe(true);
    expect(canBuy("chapters_all", ["full"])).toBe(true);
  });

  test("a chapter is not sold twice and the bundle only while no chapter is bought", () => {
    expect(canBuy("chapter_money", ["full", "chapter_money"])).toBe(false);
    expect(canBuy("chapter_stress", ["full", "chapter_money"])).toBe(true);
    expect(canBuy("chapters_all", ["full", "chapter_money"])).toBe(false);
    expect(canBuy("chapter_stress", ["full", "chapters_all"])).toBe(false);
  });

  test("the pair report is bought once per pair", () => {
    expect(canBuy("pair", [])).toBe(true);
    expect(canBuy("pair", ["pair"])).toBe(false);
  });
});

describe("friendsReportDue", () => {
  test("needs the full report and three friends", () => {
    expect(friendsReportDue(["full"], 3)).toBe(true);
    expect(friendsReportDue(["full"], 2)).toBe(false);
    expect(friendsReportDue([], 5)).toBe(false);
  });
});

test("recognizes report kinds", () => {
  expect(isReportKind("friends")).toBe(true);
  expect(isReportKind("chapters_all")).toBe(false);
});
