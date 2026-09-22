import { compareWithFriends } from "@grani/core";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { buildFriendsInput, buildPairInput, buildPersonalInput, byPronounced, personalFacts } from "./input";

const RESULT = {
  scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 },
  typeCode: "+-++",
  stability: "calm",
} as const;

describe("personalFacts", () => {
  test("names the type in the common form and labels every trait with its level", () => {
    const facts = personalFacts(RESULT);

    expect(facts.typeName).toBe("Искра");
    expect(facts.traits[0]).toEqual({ trait: "openness", label: "Открытость опыту", score: 80, level: "high" });
    expect(facts.traits.map((fact) => fact.level)).toEqual(["high", "low", "high", "high", "borderline"]);
  });

  test("orders traits by how far the score is from the middle", () => {
    expect(byPronounced(personalFacts(RESULT).traits).map((fact) => fact.trait)).toEqual([
      "openness",
      "extraversion",
      "agreeableness",
      "conscientiousness",
      "stability",
    ]);
  });
});

describe("inputs", () => {
  test("the full report takes the blocks of each trait's level and no personal data", () => {
    const input = buildPersonalInput(getLibrary(), "full", RESULT);

    expect(input.kind).toBe("full");
    if (input.kind !== "full") return;
    expect(input.blocks.traits.openness.strengths).toContain("новое");
    expect(JSON.stringify(input)).not.toMatch(/displayName|userId|resultId|female|male/);
  });

  test("a chapter takes its section for all five traits", () => {
    const input = buildPersonalInput(getLibrary(), "chapter_money", RESULT);

    expect(input.kind === "chapter_money" && input.blocks.chapter).toBe("Деньги");
    expect(input.kind === "chapter_money" && Object.keys(input.blocks.traits)).toHaveLength(5);
  });

  test("friends input carries the comparison per trait", () => {
    const self = RESULT.scores;
    const comparison = compareWithFriends(self, [self, self, { ...self, openness: 20 }])!;

    const input = buildFriendsInput(RESULT, comparison);

    expect(input.kind === "friends" && input.friends.count).toBe(3);
    expect(input.kind === "friends" && input.friends.traits.find((fact) => fact.trait === "openness")).toMatchObject({ self: 80, friends: 60, diff: -20, notable: true });
  });

  test("pair input has the score, variants and blocks of every section", () => {
    const b = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

    const input = buildPairInput(getLibrary(), RESULT.scores, b);

    expect(input.kind).toBe("pair");
    if (input.kind !== "pair") return;
    expect(input.pair.traits.find((fact) => fact.trait === "openness")).toMatchObject({ a: 80, b: 45, variant: "different" });
    expect(Object.keys(input.blocks)).toEqual(["similar", "differences", "conflicts", "home_money", "support"]);
    expect(input.pair.levelPhrase.length).toBeGreaterThan(10);
  });
});
