import { TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { TRAIT_SECTIONS } from "./keys";
import { PORTRAIT_SECTIONS, portraitSeeds } from "./portrait-seeds";
import { findStopWords } from "./safety";

const APPROVED = [
  ["start", "Как ты берёшься за дело", ["openness", "conscientiousness"], ["work"]],
  ["talk", "Как ты общаешься", ["extraversion", "agreeableness"], ["relationships"]],
  ["load", "Что происходит под нагрузкой", ["stability"], ["stress"]],
  ["energy", "Что даёт тебе энергию", ["extraversion", "openness"], ["work", "relationships"]],
  ["support", "На что в тебе можно опереться", ["agreeableness", "conscientiousness"], ["relationships", "work"]],
] as const;

describe("portraitSeeds", () => {
  test("are the five approved blocks with titles, traits and library sections, in order", () => {
    expect(portraitSeeds().map((seed) => [seed.id, seed.title, seed.traits, seed.sections])).toEqual(APPROVED.map(([id, title, traits, sections]) => [id, title, traits, sections]));
  });

  test("ids and titles are unique, ids fit the id format, titles fit the schema, focus is descriptive", () => {
    const seeds = portraitSeeds();

    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(5);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(5);
    for (const seed of seeds) {
      expect(seed.id).toMatch(/^[a-z]{2,12}$/);
      expect(seed.title.length).toBeGreaterThanOrEqual(10);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.focus.length).toBeGreaterThan(40);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
      for (const section of seed.sections) expect(PORTRAIT_SECTIONS).toContain(section);
    }
  });

  test("the library sections of the input are real sections used by the blocks", () => {
    for (const section of PORTRAIT_SECTIONS) expect(TRAIT_SECTIONS).toContain(section);
    expect(new Set(portraitSeeds().flatMap((seed) => seed.sections))).toEqual(new Set(PORTRAIT_SECTIONS));
  });

  test("the blocks draw on all five traits", () => {
    expect(new Set(portraitSeeds().flatMap((seed) => seed.traits))).toEqual(new Set(TRAITS));
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of portraitSeeds()) expect(findStopWords(`${seed.title} ${seed.focus}`), seed.id).toEqual([]);
  });
});
