import { describe, expect, test } from "vitest";
import type { Answer, Answers } from "./scoring";
import { isShortTestComplete, scoreShortTest, type ShortTestScoring } from "./short-tests";

const SCORING: ShortTestScoring = {
  axes: ["a", "b"],
  items: [
    { id: "a1", axis: "a", reverse: false },
    { id: "a2", axis: "a", reverse: true },
    { id: "b1", axis: "b", reverse: false },
    { id: "b2", axis: "b", reverse: true },
  ],
  types: [
    { key: "secure", when: { a: "low", b: "low" } },
    { key: "anxious", when: { a: "high", b: "low" } },
    { key: "avoidant", when: { a: "low", b: "high" } },
    { key: "fearful", when: { a: "high", b: "high" } },
  ],
  threshold: 50,
  mixedBand: [45, 55],
};

// high: прямое 5, обратное 1; low: наоборот
function quadrant(a: "low" | "high", b: "low" | "high"): Answers {
  const pick = (level: "low" | "high", reverse: boolean): Answer => ((level === "high") !== reverse ? 5 : 1);
  return { a1: pick(a, false), a2: pick(a, true), b1: pick(b, false), b2: pick(b, true) };
}

describe("scoreShortTest", () => {
  test("max on direct and min on reverse gives axis 100", () => {
    expect(scoreShortTest(SCORING, quadrant("high", "low")).axes).toEqual({ a: 100, b: 0 });
  });

  test("all 3 gives both axes 50, the both-high type and both axes mixed", () => {
    const score = scoreShortTest(SCORING, { a1: 3, a2: 3, b1: 3, b2: 3 });
    expect(score.axes).toEqual({ a: 50, b: 50 });
    expect(score.typeKey).toBe("fearful");
    expect(score.mixedAxes).toEqual(["a", "b"]);
  });

  test("low/high quadrants map to the four types", () => {
    expect(scoreShortTest(SCORING, quadrant("low", "low")).typeKey).toBe("secure");
    expect(scoreShortTest(SCORING, quadrant("high", "low")).typeKey).toBe("anxious");
    expect(scoreShortTest(SCORING, quadrant("low", "high")).typeKey).toBe("avoidant");
    expect(scoreShortTest(SCORING, quadrant("high", "high")).typeKey).toBe("fearful");
    expect(scoreShortTest(SCORING, quadrant("low", "high")).mixedAxes).toEqual([]);
  });

  test("throws on missing answer", () => {
    expect(() => scoreShortTest(SCORING, { a1: 3, a2: 3, b1: 3 })).toThrow();
  });

  test("throws on unknown item id", () => {
    expect(() => scoreShortTest(SCORING, { ...quadrant("low", "low"), x9: 3 })).toThrow();
  });

  test("throws on value outside 1–5", () => {
    expect(() => scoreShortTest(SCORING, { ...quadrant("low", "low"), a1: 7 as Answer })).toThrow();
  });

  test("throws when no type rule matches", () => {
    const gap = { ...SCORING, types: SCORING.types.filter((t) => t.key !== "fearful") };
    expect(() => scoreShortTest(gap, quadrant("high", "high"))).toThrow();
  });

  test("throws when more than one rule matches", () => {
    const overlap = { ...SCORING, types: [...SCORING.types, { key: "any-high-a", when: { a: "high" as const } }] };
    expect(() => scoreShortTest(overlap, quadrant("high", "low"))).toThrow();
  });
});

describe("isShortTestComplete", () => {
  test("false when an answer is missing", () => {
    expect(isShortTestComplete(SCORING, { a1: 3, a2: 3, b1: 3 })).toBe(false);
  });

  test("true for a full set", () => {
    expect(isShortTestComplete(SCORING, quadrant("low", "low"))).toBe(true);
  });
});
