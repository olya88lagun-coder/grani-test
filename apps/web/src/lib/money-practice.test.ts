import { describe, expect, test } from "vitest";
import { buildCompass, financialObservations, initialMoneyData, moneyDataSchema, recommendations } from "./money-practice";

describe("financial self-observation", () => {
  test("does not interpret missing or unknown answers as financial strengths", () => {
    expect(buildCompass(initialMoneyData().answers).every(axis => axis.state === "pending")).toBe(true);
    expect(buildCompass(Array(6).fill("unsure")).every(axis => axis.state === "observe")).toBe(true);
  });
  test("contradictory habits remain mixed instead of becoming a numerical score", () => {
    const axes = buildCompass(["a", "c", "a", "a", "b", "c"]);
    expect(axes.map(a => a.state)).toEqual(["mixed", "resource", "mixed", "practice"]);
    expect(axes.every(a => !("score" in a))).toBe(true);
    expect(buildCompass(["c", "c", "c", "c", "c", "c"]).every(a => a.state === "practice")).toBe(true);
  });
  test("each of five traits offers a hypothesis; middle scores do not force a pole", () => {
    const neutral = financialObservations({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 });
    expect(neutral).toHaveLength(5);
    expect(neutral.every(o => o.level === "borderline")).toBe(true);
    const high = financialObservations({ openness: 85, conscientiousness: 90, extraversion: 80, agreeableness: 80, stability: 85 });
    const low = financialObservations({ openness: 20, conscientiousness: 20, extraversion: 20, agreeableness: 20, stability: 20 });
    expect(high.every((o, i) => o.text !== low[i]!.text)).toBe(true);
  });
  test("four situations adapt to the relevant answer, without requiring Big Five to predict spending", () => {
    const a = recommendations(["a", "a", "a", "a", "a", "a"]);
    const c = recommendations(["c", "c", "c", "c", "c", "c"]);
    expect(a).toHaveLength(4);
    expect(a.every((s, i) => s.action !== c[i]!.action)).toBe(true);
  });
  test("rejects extra keys, invalid choices, oversized notes and inconsistent experiments", () => {
    const fresh = initialMoneyData();
    expect(moneyDataSchema.safeParse(fresh).success).toBe(true);
    for (const data of [{ ...fresh, answers: ["a"] }, { ...fresh, public: true }, { ...fresh, answers: Array(6).fill("wealthy") }, { ...fresh, notes: Array(7).fill("x".repeat(2001)) }, { ...fresh, startedOn: "2026-02-30" }, { ...fresh, done: [true, false, false, false, false, false, false] }]) {
      expect(moneyDataSchema.safeParse(data).success).toBe(false);
    }
  });
});
