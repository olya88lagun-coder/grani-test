import {
  ALL_TYPE_CODES,
  TRAITS,
  type CompatibilityLevel,
  type PairVariant,
  type Stability,
  type TraitLevel,
  type TypeCode,
} from "@grani/core";

export const TRAIT_LEVELS = ["high", "low", "borderline"] as const satisfies readonly TraitLevel[];
export const TRAIT_SECTIONS = ["strengths", "blind_spots", "work", "relationships", "money", "conflict", "stress"] as const;
export type TraitSection = (typeof TRAIT_SECTIONS)[number];
export const PAGE_POLES = ["high", "low"] as const;
export type PagePole = (typeof PAGE_POLES)[number];
export const STABILITIES = ["calm", "sensitive"] as const satisfies readonly Stability[];
export const PAIR_VARIANTS = ["both_high", "both_low", "different"] as const satisfies readonly PairVariant[];
export const PAIR_SECTIONS = ["similar", "differences", "conflicts", "home_money", "support"] as const;
export type PairSection = (typeof PAIR_SECTIONS)[number];
export const COMPATIBILITY_LEVEL_IDS = [
  "excellent",
  "high",
  "good",
  "effort",
  "challenging",
] as const satisfies readonly CompatibilityLevel[];
const TYPE_TEXT_KINDS = ["short", "long"] as const;
const COMPATIBILITY_TEXT_KINDS = ["phrase", "text"] as const;

export type Limit = { readonly min: number; readonly max: number };

export const LIMITS = {
  traitBlock: { min: 200, max: 1500 },
  traitPage: { min: 300, max: 2000 },
  typeShort: { min: 150, max: 600 },
  typeLong: { min: 1500, max: 6000 },
  stability: { min: 200, max: 1500 },
  pairBlock: { min: 200, max: 1500 },
  compatibilityPhrase: { min: 20, max: 160 },
  compatibilityText: { min: 200, max: 1500 },
} as const satisfies Record<string, Limit>;

export function typeCodeToDir(code: TypeCode): string {
  return code.replaceAll("+", "p").replaceAll("-", "m");
}

export const TYPE_DIRS: readonly string[] = ALL_TYPE_CODES.map(typeCodeToDir);

function buildLibraryFiles(): string[] {
  const files: string[] = [];
  for (const trait of TRAITS)
    for (const level of TRAIT_LEVELS)
      for (const section of TRAIT_SECTIONS) files.push(`traits/${trait}/${level}/${section}.md`);
  for (const trait of TRAITS) for (const pole of PAGE_POLES) files.push(`trait-pages/${trait}/${pole}.md`);
  for (const dir of TYPE_DIRS) for (const kind of TYPE_TEXT_KINDS) files.push(`types/${dir}/${kind}.md`);
  for (const stability of STABILITIES) files.push(`stability/${stability}.md`);
  for (const trait of TRAITS)
    for (const variant of PAIR_VARIANTS)
      for (const section of PAIR_SECTIONS) files.push(`pairs/${trait}/${variant}/${section}.md`);
  for (const level of COMPATIBILITY_LEVEL_IDS)
    for (const kind of COMPATIBILITY_TEXT_KINDS) files.push(`compatibility/${level}/${kind}.md`);
  return files;
}

export const LIBRARY_FILES: readonly string[] = buildLibraryFiles();

export function limitFor(file: string): Limit {
  const group = file.split("/")[0];
  switch (group) {
    case "traits":
      return LIMITS.traitBlock;
    case "trait-pages":
      return LIMITS.traitPage;
    case "types":
      return file.endsWith("/short.md") ? LIMITS.typeShort : LIMITS.typeLong;
    case "stability":
      return LIMITS.stability;
    case "pairs":
      return LIMITS.pairBlock;
    case "compatibility":
      return file.endsWith("/phrase.md") ? LIMITS.compatibilityPhrase : LIMITS.compatibilityText;
    default:
      throw new Error(`Unknown library file: ${file}`);
  }
}
