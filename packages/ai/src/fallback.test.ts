import { compareWithFriends, stabilityOf, TRAITS, typeCodeOf, type TraitScores } from "@grani/core";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { fallbackSections } from "./fallback";
import { ALL_PERSONAL_KINDS, buildFriendsInput, buildPairInput, buildPersonalInput } from "./input";
import { parseSections } from "./sections";

// Все 32 сочетания «высокий/низкий» по пяти чертам и профиль «всё на границе»
const PROFILES: TraitScores[] = [
  ...Array.from({ length: 32 }, (_, mask) => Object.fromEntries(TRAITS.map((trait, i) => [trait, mask & (1 << i) ? 80 : 20])) as TraitScores),
  { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 },
];

const personal = (scores: TraitScores) => ({ scores, typeCode: typeCodeOf(scores), stability: stabilityOf(scores) });

describe("fallbackSections", () => {
  test("every personal report of every profile passes the same check as the model", () => {
    for (const scores of PROFILES) {
      for (const kind of ALL_PERSONAL_KINDS) {
        const sections = fallbackSections(buildPersonalInput(getLibrary(), kind, personal(scores)));
        expect(parseSections(kind, sections), `${kind} ${JSON.stringify(scores)}`).not.toBeNull();
      }
    }
  });

  test("the full report splits blind spots into a text and a tip", () => {
    const sections = fallbackSections(buildPersonalInput(getLibrary(), "full", personal(PROFILES[0]!)));

    const full = parseSections("full", sections)!;
    expect(full.strengths).toHaveLength(5);
    expect(full.blind_spots).toHaveLength(4);
    expect(full.blind_spots[0]!.tip).not.toMatch(/^Что с этим делать/);
  });

  test("friends report explains differences and matches", () => {
    const self = PROFILES[31]!;
    const lower = { ...self, openness: 20 };
    const withDifference = compareWithFriends(self, [lower, lower, lower])!;
    const same = compareWithFriends(self, [self, self, self])!;

    const differs = parseSections("friends", fallbackSections(buildFriendsInput(personal(self), withDifference)));
    const matches = parseSections("friends", fallbackSections(buildFriendsInput(personal(self), same)));

    expect(differs?.text).toContain("«Открытость опыту»: друзья ставят тебе 20, ты себе — 80");
    expect(matches?.text).toContain("примерно так же, как ты себя");
  });

  test("pair report passes the check for different pairs", () => {
    for (const [a, b] of [[PROFILES[0]!, PROFILES[31]!], [PROFILES[31]!, PROFILES[31]!], [PROFILES[32]!, PROFILES[5]!]] as const) {
      expect(parseSections("pair", fallbackSections(buildPairInput(getLibrary(), a, b)))).not.toBeNull();
    }
  });
});
