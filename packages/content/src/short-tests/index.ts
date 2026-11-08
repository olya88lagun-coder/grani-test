import { combinationKey } from "@grani/core";
import { ATTACHMENT_TEST } from "./attachment";
import { ATTACHMENT_COMBINATIONS } from "./attachment-pairs";
import { TEMPERAMENT_TEST } from "./temperament";
import type { ShortPairCombination, ShortTestDefinition, ShortTestType } from "./types";

export { ATTACHMENT_COMBINATIONS };
export type { ShortPairCombination, ShortPairReportBlocks, ShortReportBlocks, ShortReportExercise, ShortTestAxisInfo, ShortTestDefinition, ShortTestSection, ShortTestType } from "./types";

export const SHORT_TESTS: readonly ShortTestDefinition[] = [ATTACHMENT_TEST, TEMPERAMENT_TEST];

export function getShortTest(slug: string): ShortTestDefinition | null {
  return SHORT_TESTS.find((test) => test.slug === slug) ?? null;
}

export function shortTestTypeBySlug(test: ShortTestDefinition, slug: string): ShortTestType | null {
  return test.types.find((type) => type.slug === slug) ?? null;
}

const COMBINATIONS: Readonly<Record<string, readonly ShortPairCombination[]>> = { attachment: ATTACHMENT_COMBINATIONS };

// Сочетание двух типов в паре; порядок партнёров не важен. У теста без режима пары сочетаний нет
export function getCombination(slug: string, typeA: string, typeB: string): ShortPairCombination | null {
  const test = getShortTest(slug);
  const list = COMBINATIONS[slug];
  if (!test || !list) return null;
  const key = combinationKey(test.types.map((type) => type.key), typeA, typeB);
  return list.find((combination) => combination.key === key) ?? null;
}
