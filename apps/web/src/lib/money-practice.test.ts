import { hedgeCount } from "@grani/ai";
import { describe, expect, test } from "vitest";
import { buildCompass, COMPASS_LABELS, directionDetails, financialObservations, initialMoneyData, moneyDataSchema, RECALL_NOTE, recommendations, recommendedHabit, STATE_NOTES } from "./money-practice";

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

const ALL_A = Array(6).fill("a") as ("a" | "b" | "c" | "unsure" | null)[];
const ALL_C = Array(6).fill("c") as ("a" | "b" | "c" | "unsure" | null)[];
const ANSWER_SETS = [Array(6).fill(null), ALL_A, ALL_C, Array(6).fill("unsure"), ["a", "c", "a", "a", "b", "c"]] as const;

describe("directions", () => {
  test("every direction carries its own situation, step and phrase, in the axes order", () => {
    const directions = directionDetails(ALL_C);

    expect(directions.map(d => d.id)).toEqual(["plan", "pause", "boundaries", "conditions"]);
    expect(directions.map(d => d.situation)).toEqual(["Появилась неожиданная трата", "Хочется купить прямо сейчас", "Нужно договориться о деньгах", "Предлагают что-то незнакомое"]);
    for (const d of directions) {
      expect(d.action.length).toBeGreaterThan(20);
      expect(d.phrase.length).toBeGreaterThan(10);
      expect(d.note).toBe(STATE_NOTES[d.state]);
    }
  });

  test("steps carry no repeated lead-in, whatever the answers are", () => {
    for (const answers of ANSWER_SETS) {
      for (const s of recommendations(answers)) expect(s.action).not.toContain("Сначала вспомни один недавний случай");
    }
    expect(RECALL_NOTE).toContain("вспомни один недавний случай");
  });

  test("every direction carries the golden icon of the chapter theme closest to its situation", () => {
    expect(directionDetails(ALL_C).map(d => d.icon)).toEqual(["/chapters/money/surprise.webp", "/chapters/money/mood.webp", "/chapters/money/shared.webp", "/chapters/money/new.webp"]);
  });
  test("the recall flag is raised only for missing or unknown answers of the direction's situation", () => {
    expect(directionDetails(Array(6).fill(null)).every(d => d.recall)).toBe(true);
    expect(directionDetails(Array(6).fill("unsure")).every(d => d.recall)).toBe(true);
    expect(directionDetails(ALL_A).some(d => d.recall)).toBe(false);
    expect(directionDetails(["a", "a", "a", "a", "a", null]).map(d => d.recall)).toEqual([false, false, false, true]);
  });

  test("a step for a supported answer differs from the step for an experiment", () => {
    const supported = directionDetails(ALL_A).map(d => d.action);
    const experiment = directionDetails(ALL_C).map(d => d.action);
    supported.forEach((action, i) => expect(action).not.toBe(experiment[i]));
  });
});

describe("recommendedHabit", () => {
  test("takes the first direction that is a topic for a step and maps it to a habit", () => {
    expect(recommendedHabit(buildCompass(ALL_C))).toBe("review");
    expect(recommendedHabit(buildCompass(["a", "a", "c", "c", "a", "a"]))).toBe("pause");
    expect(recommendedHabit(buildCompass(["a", "a", "a", "a", "c", "a"]))).toBe("boundary");
    expect(recommendedHabit(buildCompass(["a", "a", "a", "a", "a", "c"]))).toBe("review");
  });

  test("falls back to the first mixed direction, and gives nothing without a topic", () => {
    expect(recommendedHabit(buildCompass(["a", "c", "a", "a", "a", "a"]))).toBe("review");
    expect(recommendedHabit(buildCompass(ALL_A))).toBeNull();
    expect(recommendedHabit(buildCompass(Array(6).fill(null)))).toBeNull();
    expect(recommendedHabit(buildCompass(Array(6).fill("unsure")))).toBeNull();
  });
});

describe("texts", () => {
  test("every text of the page keeps to one hedge at most and has no empty phrases", () => {
    const scoresLow = { openness: 20, conscientiousness: 20, extraversion: 20, agreeableness: 20, stability: 20 };
    const scoresMid = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 };
    const scoresHigh = { openness: 85, conscientiousness: 85, extraversion: 85, agreeableness: 85, stability: 85 };
    const texts = [
      ...[scoresLow, scoresMid, scoresHigh].flatMap(scores => financialObservations(scores).map(o => o.text)),
      ...Object.values(STATE_NOTES),
      ...ANSWER_SETS.flatMap(answers => recommendations(answers).map(s => s.action)),
      RECALL_NOTE,
    ];

    for (const text of texts) {
      expect(hedgeCount(text), text).toBeLessThanOrEqual(1);
      expect(text).not.toMatch(/Проверь, удобно ли|в твоей конкретной ситуации/);
    }
  });

  test("the labels of the compass are neutral and the supported state names a familiar way", () => {
    expect(COMPASS_LABELS.resource).toBe("Знакомый способ, на который можно опереться");
    expect(COMPASS_LABELS.mixed).toBe("Зависит от ситуации");
  });
});
