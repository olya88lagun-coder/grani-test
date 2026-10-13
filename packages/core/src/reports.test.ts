import { describe, expect, test } from "vitest";
import { isProduct } from "./pricing";
import { CHAPTER_KINDS, EXTRA_KINDS, canBuy, friendsReportDue, isExtraKind, isReportKind, productTarget, reportKindsFor, unlockedKinds } from "./reports";

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

  test("collects everything the purchases opened, the life cards come with the full report", () => {
    expect([...unlockedKinds(["full", "chapters_all"])].sort()).toEqual(["chapter_conflict", "chapter_money", "chapter_relationships", "chapter_stress", "full", "life", "portrait"]);
  });

  test("extra reports open with the full report, are not sold and are recognised by isExtraKind", () => {
    expect(EXTRA_KINDS).toEqual(["life", "portrait"]);
    for (const kind of EXTRA_KINDS) {
      expect(isReportKind(kind)).toBe(true);
      expect(isProduct(kind)).toBe(false);
      expect(unlockedKinds(["full"]).has(kind)).toBe(true);
      expect(unlockedKinds(["chapters_all"]).has(kind)).toBe(false);
      expect(unlockedKinds(["pair"]).has(kind)).toBe(false);
      expect(isExtraKind(kind)).toBe(true);
    }
    expect(isExtraKind("full")).toBe(false);
    expect(isExtraKind("chapter_money")).toBe(false);
    expect(isExtraKind(undefined)).toBe(false);
    expect(reportKindsFor("full")).toEqual(["full"]);
  });

  test("the life cards are not sold and open only with the full report", () => {
    expect(isReportKind("life")).toBe(true);
    expect(isProduct("life")).toBe(false);
    expect(reportKindsFor("full")).toEqual(["full"]);
    expect(unlockedKinds(["full"]).has("life")).toBe(true);
    expect(unlockedKinds(["chapter_money"]).has("life")).toBe(false);
    expect(unlockedKinds(["pair"]).has("life")).toBe(false);
    expect(unlockedKinds([]).has("life")).toBe(false);
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
