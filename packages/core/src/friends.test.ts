import { describe, expect, test } from "vitest";
import type { TraitScores } from "./traits";
import { averageScores, compareWithFriends, MIN_FRIENDS } from "./friends";

function scores(overrides: Partial<Record<keyof TraitScores, number>> = {}): TraitScores {
  return { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50, ...overrides };
}

describe("averageScores", () => {
  test("rounds the mean of each trait to an integer", () => {
    const average = averageScores([scores({ openness: 61 }), scores({ openness: 70 }), scores({ openness: 66 })]);

    expect(average.openness).toBe(66); // 65.67 → 66
    expect(average.stability).toBe(50);
  });

  test("throws on an empty list", () => {
    expect(() => averageScores([])).toThrow();
  });
});

describe("compareWithFriends", () => {
  test.each([0, 1, 2])("returns null with %i answers", (count) => {
    const friends = Array.from({ length: count }, () => scores({ openness: 90 }));

    expect(compareWithFriends(scores(), friends)).toBeNull();
  });

  test("is available from exactly MIN_FRIENDS answers", () => {
    const friends = Array.from({ length: MIN_FRIENDS }, () => scores());

    expect(compareWithFriends(scores(), friends)?.friendsCount).toBe(3);
  });

  test("marks a difference of 15 as not notable and 16 as notable", () => {
    const self = scores();
    const friends = [
      scores({ openness: 60, extraversion: 61 }),
      scores({ openness: 70, extraversion: 70 }),
      scores({ openness: 65, extraversion: 66 }),
    ];

    const result = compareWithFriends(self, friends);

    expect(result?.traits.openness).toEqual({ self: 50, friends: 65, diff: 15, notable: false });
    expect(result?.traits.extraversion).toEqual({ self: 50, friends: 66, diff: 16, notable: true });
  });

  test("treats negative differences by absolute value", () => {
    const friends = [scores({ agreeableness: 30 }), scores({ agreeableness: 30 }), scores({ agreeableness: 36 })];

    const result = compareWithFriends(scores({ agreeableness: 50 }), friends);

    expect(result?.traits.agreeableness).toEqual({ self: 50, friends: 32, diff: -18, notable: true });
  });

  test("exposes only the rounded average, not individual answers", () => {
    const friends = [scores({ stability: 10 }), scores({ stability: 20 }), scores({ stability: 90 })];

    const result = compareWithFriends(scores(), friends);

    expect(Object.keys(result ?? {}).sort()).toEqual(["average", "friendsCount", "traits"]);
    expect(result?.average.stability).toBe(40);
  });
});
