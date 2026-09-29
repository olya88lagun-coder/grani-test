import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_KEY,
  GOALS,
  progressGoalsCrossed,
  goalForProduct,
  METRIKA_ID,
  reachGoal,
  readChoice,
  sanitizePath,
  sanitizeReferrer,
  saveChoice,
  withLoginMark,
} from "./analytics";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

const UUID = "0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f";

describe("cookie choice", () => {
  it("reads only known values and saves the choice", () => {
    const storage = memoryStorage();
    expect(readChoice(storage)).toBeNull();
    saveChoice(storage, "all");
    expect(readChoice(storage)).toBe("all");
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: "yes" }))).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readChoice(broken)).toBeNull();
    expect(() => saveChoice(broken, "necessary")).not.toThrow();
  });
});

describe("sanitizePath", () => {
  it("hides ids and invite tokens", () => {
    expect(sanitizePath(`/result/${UUID}`)).toBe("/result/:id");
    expect(sanitizePath(`/report/${UUID}?x=1`)).toBe("/report/:id");
    expect(sanitizePath("/f/AbC123xyz/done")).toBe("/f/:id/done");
    expect(sanitizePath("/p/AbC123xyz")).toBe("/p/:id");
    expect(sanitizePath(`/pair/${UUID}`)).toBe("/pair/:id");
    expect(sanitizePath(`/purchases/${UUID}`)).toBe("/purchases/:id");
    expect(sanitizePath(`/cards/manual/${UUID}`)).toBe("/cards/manual/:id");
  });

  it("keeps public pages as they are, without the query", () => {
    expect(sanitizePath("/types/iskra")).toBe("/types/iskra");
    expect(sanitizePath("/privacy")).toBe("/privacy");
    expect(sanitizePath("/?deleted=1")).toBe("/");
    expect(sanitizePath("")).toBe("/");
  });
});

describe("sanitizeReferrer", () => {
  const origin = "https://grani-test.ru";

  it("cleans own pages and keeps only the origin of other sites", () => {
    expect(sanitizeReferrer(`${origin}/result/${UUID}?from=login`, origin)).toBe(`${origin}/result/:id`);
    expect(sanitizeReferrer("https://yandex.ru/search/?text=тест", origin)).toBe("https://yandex.ru");
  });

  it("returns nothing for an empty or broken referrer", () => {
    expect(sanitizeReferrer("", origin)).toBeUndefined();
    expect(sanitizeReferrer("not a url", origin)).toBeUndefined();
  });
});

describe("login mark", () => {
  it("adds the mark and keeps the existing query", () => {
    expect(withLoginMark(`/result/${UUID}`)).toBe(`/result/${UUID}?from=login`);
    expect(withLoginMark("/p/tok?x=1")).toBe("/p/tok?x=1&from=login");
  });
});

describe("goals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has the spec goals plus the pair ones", () => {
    expect(GOALS).toEqual([
      "test_start",
      "test_finish",
      "login",
      "invite_shared",
      "pair_invite_shared",
      "friend_answered",
      "purchase_full",
      "purchase_chapter",
      "purchase_pair",
      "test_25",
      "test_50",
      "test_75",
      "result_view",
      "story_share",
      "report_click",
      "checkout_start",
    ]);
  });

  it("reports each progress milestone once, when an answer crosses it", () => {
    expect(progressGoalsCrossed(12, 13, 50)).toEqual(["test_25"]);
    expect(progressGoalsCrossed(13, 14, 50)).toEqual([]);
    expect(progressGoalsCrossed(24, 25, 50)).toEqual(["test_50"]);
    expect(progressGoalsCrossed(37, 38, 50)).toEqual(["test_75"]);
    // Восстановленный после перезагрузки прогресс не повторяет цели: считаются только переходы
    expect(progressGoalsCrossed(38, 38, 50)).toEqual([]);
    expect(progressGoalsCrossed(0, 50, 50)).toEqual(["test_25", "test_50", "test_75"]);
  });

  it("maps products to purchase goals", () => {
    expect(goalForProduct("full")).toBe("purchase_full");
    expect(goalForProduct("chapter_money")).toBe("purchase_chapter");
    expect(goalForProduct("chapters_all")).toBe("purchase_chapter");
    expect(goalForProduct("pair")).toBe("purchase_pair");
  });

  it("does nothing before Metrika is loaded and calls ym after", () => {
    vi.stubGlobal("window", {});
    expect(() => reachGoal("test_start")).not.toThrow();
    const ym = vi.fn();
    vi.stubGlobal("window", { ym });
    reachGoal("login");
    expect(ym).toHaveBeenCalledWith(METRIKA_ID, "reachGoal", "login", undefined);
  });
});
