import { scoreShortTest, type Answer, type Answers } from "@grani/core";
import { getShortTest } from "@grani/content/short-tests";
import { describe, expect, test } from "vitest";
import { parseStoredShortResult, serializeShortResult, shortResultStorageKey, shortResultView } from "./short-test-result";

const TEST = getShortTest("attachment")!;
const ALL_3: Answers = Object.fromEntries(TEST.items.map((item) => [item.id, 3 as Answer]));
// Высокая тревожность, низкое избегание
const ANXIOUS: Answers = Object.fromEntries(
  TEST.scoring.items.map((item) => {
    const high = item.axis === "anxiety";
    return [item.id, (high !== item.reverse ? 5 : 1) as Answer];
  }),
);

describe("short test result storage", () => {
  test("storage key is namespaced by slug", () => {
    expect(shortResultStorageKey("attachment")).toBe("grani:short:attachment:result");
  });

  test("serialize then parse gives the same score as scoring the answers", () => {
    const raw = serializeShortResult("attachment", ANXIOUS, new Date("2026-11-07T10:00:00Z"));
    expect(parseStoredShortResult(raw, TEST)).toEqual(scoreShortTest(TEST.scoring, ANXIOUS));
  });

  test.each([
    ["null", null],
    ["not json", "не json"],
    ["other version", JSON.stringify({ v: 2, slug: "attachment", answers: ANXIOUS, at: "x" })],
    ["other slug", JSON.stringify({ v: 1, slug: "temperament", answers: ANXIOUS, at: "x" })],
    ["incomplete answers", JSON.stringify({ v: 1, slug: "attachment", answers: { an01: 3 }, at: "x" })],
    ["answer out of range", JSON.stringify({ v: 1, slug: "attachment", answers: { ...ANXIOUS, an01: 7 }, at: "x" })],
    ["unknown item id", JSON.stringify({ v: 1, slug: "attachment", answers: { ...ANXIOUS, zz99: 3 }, at: "x" })],
    ["answers not an object", JSON.stringify({ v: 1, slug: "attachment", answers: "x", at: "x" })],
  ])("returns null for %s", (_name, raw) => {
    expect(parseStoredShortResult(raw, TEST)).toBeNull();
  });
});

describe("shortResultView", () => {
  test("type matches the score type", () => {
    const score = scoreShortTest(TEST.scoring, ANXIOUS);
    expect(shortResultView(TEST, score).type.key).toBe("anxious");
  });

  test("axis at 50% is mixed and uses the mixed text", () => {
    const view = shortResultView(TEST, scoreShortTest(TEST.scoring, ALL_3));
    for (const axis of view.axes) {
      expect(axis.value).toBe(50);
      expect(axis.mixed).toBe(true);
      expect(axis.text).toBe(axis.info.mixed);
    }
  });

  test("high and low axes use their texts", () => {
    const view = shortResultView(TEST, scoreShortTest(TEST.scoring, ANXIOUS));
    const anxiety = view.axes.find((a) => a.info.key === "anxiety")!;
    const avoidance = view.axes.find((a) => a.info.key === "avoidance")!;
    expect(anxiety.value).toBe(100);
    expect(anxiety.text).toBe(anxiety.info.high);
    expect(avoidance.text).toBe(avoidance.info.low);
  });
});
