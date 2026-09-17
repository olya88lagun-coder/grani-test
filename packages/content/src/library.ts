import { z } from "zod";
import {
  TRAITS,
  type CompatibilityLevel,
  type PairVariant,
  type Stability,
  type Trait,
  type TraitLevel,
  type TypeCode,
} from "@grani/core";
import {
  COMPATIBILITY_LEVEL_IDS,
  LIMITS,
  PAGE_POLES,
  PAIR_SECTIONS,
  PAIR_VARIANTS,
  STABILITIES,
  TRAIT_LEVELS,
  TRAIT_SECTIONS,
  TYPE_DIRS,
  typeCodeToDir,
  type Limit,
  type PagePole,
  type PairSection,
  type TraitSection,
} from "./keys";

function text(limit: Limit) {
  return z.string().min(limit.min).max(limit.max);
}

function keyed<const K extends readonly string[], V extends z.ZodType>(keys: K, value: V) {
  const shape = Object.fromEntries(keys.map((key) => [key, value])) as { [P in K[number]]: V };
  return z.strictObject(shape);
}

export const LibrarySchema = z.strictObject({
  traits: keyed(TRAITS, keyed(TRAIT_LEVELS, keyed(TRAIT_SECTIONS, text(LIMITS.traitBlock)))),
  "trait-pages": keyed(TRAITS, keyed(PAGE_POLES, text(LIMITS.traitPage))),
  types: keyed(TYPE_DIRS, z.strictObject({ short: text(LIMITS.typeShort), long: text(LIMITS.typeLong) })),
  stability: keyed(STABILITIES, text(LIMITS.stability)),
  pairs: keyed(TRAITS, keyed(PAIR_VARIANTS, keyed(PAIR_SECTIONS, text(LIMITS.pairBlock)))),
  compatibility: keyed(
    COMPATIBILITY_LEVEL_IDS,
    z.strictObject({ phrase: text(LIMITS.compatibilityPhrase), text: text(LIMITS.compatibilityText) }),
  ),
});

export type Library = z.infer<typeof LibrarySchema>;

export class LibraryError extends Error {
  override name = "LibraryError";
}

export function parseLibrary(raw: unknown): Library {
  const result = LibrarySchema.safeParse(raw);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => `${issue.path.join("/")}: ${issue.message}`).join("\n");
  throw new LibraryError(`Invalid content library:\n${details}`);
}

export function traitBlock(library: Library, trait: Trait, level: TraitLevel, section: TraitSection): string {
  return library.traits[trait][level][section];
}

export function traitPageIntro(library: Library, trait: Trait, pole: PagePole): string {
  return library["trait-pages"][trait][pole];
}

export function typeTexts(library: Library, code: TypeCode): { readonly short: string; readonly long: string } {
  const entry = library.types[typeCodeToDir(code)];
  if (entry === undefined) throw new LibraryError(`No texts for type ${code}`);
  return entry;
}

export function stabilityText(library: Library, stability: Stability): string {
  return library.stability[stability];
}

export function pairBlock(library: Library, trait: Trait, variant: PairVariant, section: PairSection): string {
  return library.pairs[trait][variant][section];
}

export function compatibilityTexts(
  library: Library,
  level: CompatibilityLevel,
): { readonly phrase: string; readonly text: string } {
  return library.compatibility[level];
}
