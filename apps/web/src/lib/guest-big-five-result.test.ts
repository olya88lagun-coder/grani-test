import { SELF_ITEMS } from "@grani/content";
import type { Answers } from "@grani/core";
import { describe, expect, test } from "vitest";
import {
  guestBigFiveView,
  parseGuestBigFiveAnswers,
  parseStoredGuestBigFiveResult,
  serializeGuestBigFiveResult,
} from "./guest-big-five-result";

function all(value: 1 | 2 | 3 | 4 | 5): Answers {
  return Object.fromEntries(SELF_ITEMS.map((item) => [item.id, value])) as Answers;
}

describe("parseGuestBigFiveAnswers", () => {
  test("accepts a complete set of answers", () => {
    expect(parseGuestBigFiveAnswers(all(3))).not.toBeNull();
  });

  test("rejects incomplete or out-of-range answers", () => {
    expect(parseGuestBigFiveAnswers({})).toBeNull();
    expect(parseGuestBigFiveAnswers({ ...all(3), "ipip-01": 0 })).toBeNull();
    expect(parseGuestBigFiveAnswers({ ...all(3), "ipip-01": 6 })).toBeNull();
  });
});

describe("guestBigFiveView", () => {
  test("returns a type name and five scales", () => {
    const view = guestBigFiveView(all(3));
    expect(view.name.length).toBeGreaterThan(0);
    expect(view.scales).toHaveLength(5);
    expect(view.scales.map((scale) => scale.trait)).toEqual([
      "openness",
      "conscientiousness",
      "extraversion",
      "agreeableness",
      "stability",
    ]);
    for (const scale of view.scales) {
      expect(scale.score).toBeGreaterThanOrEqual(0);
      expect(scale.score).toBeLessThanOrEqual(100);
      expect(scale.label.length).toBeGreaterThan(0);
    }
  });
});

describe("guest result storage", () => {
  test("round-trips a valid result and rejects tampering", () => {
    const answers = all(4);
    const raw = serializeGuestBigFiveResult(answers, new Date("2026-01-01T00:00:00.000Z"));
    const view = parseStoredGuestBigFiveResult(raw);
    expect(view?.name).toBe(guestBigFiveView(answers).name);
    expect(parseStoredGuestBigFiveResult(null)).toBeNull();
    expect(parseStoredGuestBigFiveResult("{")).toBeNull();
    expect(parseStoredGuestBigFiveResult(JSON.stringify({ v: 1, answers: { "ipip-01": 3 } }))).toBeNull();
  });
});
