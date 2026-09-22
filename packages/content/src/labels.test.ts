import { CHAPTER_KINDS, TRAITS } from "@grani/core";
import { expect, test } from "vitest";
import { TRAIT_SECTIONS } from "./keys";
import { CHAPTER_SECTIONS, CHAPTER_TITLES, TRAIT_LABELS } from "./labels";

test("every trait and chapter has a label, chapters map to library sections", () => {
  expect(TRAITS.map((trait) => TRAIT_LABELS[trait])).toEqual(["Открытость опыту", "Добросовестность", "Экстраверсия", "Доброжелательность", "Эмоциональная устойчивость"]);
  expect(CHAPTER_KINDS.map((kind) => CHAPTER_TITLES[kind])).toEqual(["Деньги", "Конфликты", "Стресс", "Отношения"]);
  for (const kind of CHAPTER_KINDS) expect(TRAIT_SECTIONS).toContain(CHAPTER_SECTIONS[kind]);
});
