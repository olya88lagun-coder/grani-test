import { CHAPTER_KINDS, TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterSeeds, hasCardsFormat } from "./chapter-seeds";
import { findStopWords } from "./safety";

describe("chapterSeeds", () => {
  test("the money chapter has six distinct themes with valid traits", () => {
    const seeds = chapterSeeds("chapter_money");

    expect(seeds).toHaveLength(6);
    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(6);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(6);
    for (const seed of seeds) {
      expect(seed.title.length).toBeGreaterThanOrEqual(8);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.traits.length).toBeGreaterThan(0);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
    }
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of chapterSeeds("chapter_money")) expect(findStopWords(`${seed.title} ${seed.focus}`)).toEqual([]);
  });

  test("only the money chapter uses the cards format in the pilot", () => {
    expect(hasCardsFormat("chapter_money")).toBe(true);
    for (const kind of CHAPTER_KINDS.filter((kind) => kind !== "chapter_money")) {
      expect(hasCardsFormat(kind)).toBe(false);
      expect(chapterSeeds(kind)).toEqual([]);
    }
  });
});
