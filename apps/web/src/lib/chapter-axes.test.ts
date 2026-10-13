import { describe, expect, test } from "vitest";
import { chapterAxes } from "./chapter-axes";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };

describe("chapterAxes", () => {
  test("the money chapter has three axes taken from the matching scores", () => {
    const axes = chapterAxes("chapter_money", SCORES);

    expect(axes.map((axis) => [axis.trait, axis.value])).toEqual([["openness", 30], ["agreeableness", 60], ["stability", 35]]);
    for (const axis of axes) {
      expect(axis.low.length).toBeGreaterThan(5);
      expect(axis.high.length).toBeGreaterThan(5);
    }
  });

  test("scores are clamped to 0–100 and rounded", () => {
    expect(chapterAxes("chapter_money", { ...SCORES, openness: 130.4, agreeableness: -5, stability: 49.6 }).map((axis) => axis.value)).toEqual([100, 0, 50]);
  });

  test.each(["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"] as const)("%s has three axes with both poles named", (kind) => {
    const axes = chapterAxes(kind, SCORES);

    expect(axes).toHaveLength(3);
    for (const axis of axes) {
      expect(axis.low.length).toBeGreaterThan(5);
      expect(axis.high.length).toBeGreaterThan(5);
      expect(axis.low).not.toBe(axis.high);
    }
    expect(new Set(axes.map((axis) => axis.trait)).size).toBe(3);
  });
});
