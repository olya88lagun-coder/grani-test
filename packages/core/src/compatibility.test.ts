import { describe, expect, test } from "vitest";
import { TRAITS, type TraitScores } from "./traits";
import { compatibilityLevel, compatibilityScore, pairVariant, pairVariants } from "./compatibility";

function uniform(value: number): TraitScores {
  return Object.fromEntries(TRAITS.map((trait) => [trait, value])) as TraitScores;
}

describe("compatibilityScore", () => {
  test("is 100 for two identical profiles with maximal agreeableness and stability", () => {
    expect(compatibilityScore(uniform(100), uniform(100))).toBe(100);
  });

  test("is 50 for two identical profiles with zero agreeableness and stability", () => {
    expect(compatibilityScore(uniform(0), uniform(0))).toBe(50);
  });

  test("is 25 for opposite extreme profiles", () => {
    expect(compatibilityScore(uniform(100), uniform(0))).toBe(25);
  });

  test("combines resource and similarity with equal weights", () => {
    const a: TraitScores = { openness: 80, conscientiousness: 60, extraversion: 30, agreeableness: 70, stability: 40 };
    const b: TraitScores = { openness: 50, conscientiousness: 70, extraversion: 40, agreeableness: 90, stability: 60 };
    // ресурс: (70 + 90 + 40 + 60) / 4 = 65
    // схожесть: (70 + 90 + 90) / 3 = 83.33
    // итог: 0.5 × 65 + 0.5 × 83.33 = 74.17 → 74

    expect(compatibilityScore(a, b)).toBe(74);
  });

  test("is symmetric", () => {
    const a: TraitScores = { openness: 12, conscientiousness: 97, extraversion: 55, agreeableness: 31, stability: 68 };
    const b: TraitScores = { openness: 76, conscientiousness: 40, extraversion: 3, agreeableness: 88, stability: 21 };

    expect(compatibilityScore(a, b)).toBe(compatibilityScore(b, a));
  });
});

describe("compatibilityLevel", () => {
  test.each([
    [0, "challenging"],
    [44, "challenging"],
    [45, "effort"],
    [59, "effort"],
    [60, "good"],
    [74, "good"],
    [75, "high"],
    [84, "high"],
    [85, "excellent"],
    [100, "excellent"],
  ] as const)("%i → %s", (score, expected) => {
    expect(compatibilityLevel(score)).toBe(expected);
  });
});

describe("pairVariant", () => {
  test.each([
    [60, 85, "both_high"], // разница 25 — ещё не «разные»
    [60, 86, "different"], // разница 26
    [86, 60, "different"],
    [50, 50, "both_high"],
    [49, 49, "both_low"],
    [52, 40, "both_low"], // смешанный случай: среднее 46
    [40, 65, "both_high"], // смешанный случай: среднее 52.5
  ] as const)("%i and %i → %s", (a, b, expected) => {
    expect(pairVariant(a, b)).toBe(expected);
  });
});

describe("pairVariants", () => {
  test("returns a variant for every trait", () => {
    const a: TraitScores = { openness: 90, conscientiousness: 30, extraversion: 60, agreeableness: 20, stability: 70 };
    const b: TraitScores = { openness: 20, conscientiousness: 35, extraversion: 70, agreeableness: 25, stability: 50 };

    expect(pairVariants(a, b)).toEqual({
      openness: "different",
      conscientiousness: "both_low",
      extraversion: "both_high",
      agreeableness: "both_low",
      stability: "both_high",
    });
  });
});
