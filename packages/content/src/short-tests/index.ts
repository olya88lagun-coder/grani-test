import { ATTACHMENT_TEST } from "./attachment";
import type { ShortTestDefinition, ShortTestType } from "./types";

export type { ShortTestAxisInfo, ShortTestDefinition, ShortTestSection, ShortTestType } from "./types";

export const SHORT_TESTS: readonly ShortTestDefinition[] = [ATTACHMENT_TEST];

export function getShortTest(slug: string): ShortTestDefinition | null {
  return SHORT_TESTS.find((test) => test.slug === slug) ?? null;
}

export function shortTestTypeBySlug(test: ShortTestDefinition, slug: string): ShortTestType | null {
  return test.types.find((type) => type.slug === slug) ?? null;
}
