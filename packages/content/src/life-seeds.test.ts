import { TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterSeeds } from "./chapter-seeds";
import { CHAPTER_SECTIONS, CHAPTER_TITLES } from "./labels";
import { cardSeeds, cardsSections, cardsTitle, LIFE_SECTIONS, LIFE_TITLE, lifeSeeds } from "./life-seeds";
import { findStopWords } from "./safety";

const APPROVED = [
  ["change", "Планы внезапно изменились", ["openness", "conscientiousness"]],
  ["critique", "Твою идею раскритиковали", ["stability", "openness"]],
  ["deadline", "Срок подходит, работа не закончена", ["conscientiousness", "stability"]],
  ["talk", "Предстоит непростой разговор", ["agreeableness", "extraversion"]],
  ["method", "Коллега предлагает другой способ", ["openness", "agreeableness"]],
] as const;

describe("lifeSeeds", () => {
  test("are the five approved situations with their titles and traits, in order", () => {
    expect(lifeSeeds().map((seed) => [seed.id, seed.title, seed.traits])).toEqual(APPROVED.map(([id, title, traits]) => [id, title, traits]));
  });

  test("ids and titles are unique, ids fit the id format, focus texts are descriptive", () => {
    const seeds = lifeSeeds();

    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(5);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(5);
    for (const seed of seeds) {
      expect(seed.id).toMatch(/^[a-z]{2,12}$/);
      expect(seed.title.length).toBeGreaterThanOrEqual(8);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.focus.length).toBeGreaterThan(40);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
    }
  });

  test("the situations draw on all five traits", () => {
    expect(new Set(lifeSeeds().flatMap((seed) => seed.traits))).toEqual(new Set(TRAITS));
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of lifeSeeds()) expect(findStopWords(`${seed.title} ${seed.focus}`), seed.id).toEqual([]);
  });
});

describe("card topics", () => {
  test("a chapter keeps its own seeds, title and one library section", () => {
    expect(cardSeeds("chapter_money")).toEqual(chapterSeeds("chapter_money"));
    expect(cardsTitle("chapter_money")).toBe(CHAPTER_TITLES.chapter_money);
    expect(cardsSections("chapter_money")).toEqual([CHAPTER_SECTIONS.chapter_money]);
  });

  test("life has its own seeds, a title and three library sections", () => {
    expect(cardSeeds("life")).toEqual(lifeSeeds());
    expect(cardsTitle("life")).toBe(LIFE_TITLE);
    expect(cardsSections("life")).toEqual(LIFE_SECTIONS);
    expect(LIFE_SECTIONS).toEqual(["work", "conflict", "stress"]);
  });
});
