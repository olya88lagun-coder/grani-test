import { CHAPTER_KINDS, TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterSeeds, hasCardsFormat } from "./chapter-seeds";
import { findStopWords } from "./safety";

const CHAPTERS = CHAPTER_KINDS;

describe("chapterSeeds", () => {
  test.each(CHAPTERS)("%s has six distinct themes with valid traits", (kind) => {
    const seeds = chapterSeeds(kind);

    expect(seeds).toHaveLength(6);
    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(6);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(6);
    for (const seed of seeds) {
      expect(seed.id).toMatch(/^[a-z]{2,12}$/);
      expect(seed.title.length).toBeGreaterThanOrEqual(8);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.focus.length).toBeGreaterThan(40);
      expect(seed.traits.length).toBeGreaterThan(0);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
    }
  });

  test("theme texts pass the stop-word check", () => {
    for (const kind of CHAPTERS) for (const seed of chapterSeeds(kind)) expect(findStopWords(`${seed.title} ${seed.focus}`), seed.id).toEqual([]);
  });

  test("every chapter uses the cards format", () => {
    for (const kind of CHAPTERS) expect(hasCardsFormat(kind)).toBe(true);
  });

  test("each chapter draws on at least four traits across its themes", () => {
    for (const kind of CHAPTERS) expect(new Set(chapterSeeds(kind).flatMap((seed) => seed.traits)).size, kind).toBeGreaterThanOrEqual(4);
  });
});
