import {
  CHAPTER_KINDS,
  compatibilityLevel,
  compatibilityScore,
  pairVariants,
  TRAITS,
  traitLevel,
  typeName,
  type ChapterKind,
  type FriendComparison,
  type PairVariant,
  type Stability,
  type Trait,
  type TraitLevel,
  type TraitScores,
  type TypeCode,
} from "@grani/core";
import {
  CHAPTER_SECTIONS,
  CHAPTER_TITLES,
  compatibilityTexts,
  pairBlock,
  PAIR_SECTIONS,
  stabilityText,
  TRAIT_LABELS,
  traitBlock,
  typeTexts,
  type Library,
  type PairSection,
} from "@grani/content";

export type TraitFact = { trait: Trait; label: string; score: number; level: TraitLevel };
export type PersonalFacts = { typeCode: TypeCode; typeName: string; stability: Stability; traits: readonly TraitFact[] };
export type PersonalScores = { scores: TraitScores; typeCode: TypeCode; stability: Stability };

const FULL_SECTIONS = ["strengths", "blind_spots", "work", "conflict", "stress"] as const;
type FullSection = (typeof FULL_SECTIONS)[number];

export type FriendFact = { trait: Trait; label: string; self: number; friends: number; diff: number; notable: boolean };
export type PairFact = { trait: Trait; label: string; a: number; b: number; variant: PairVariant };

export type ReportInput =
  | { kind: "full"; facts: PersonalFacts; blocks: { typeShort: string; stability: string; traits: Record<Trait, Record<FullSection, string>> } }
  | { kind: ChapterKind; facts: PersonalFacts; blocks: { chapter: string; traits: Record<Trait, string> } }
  | { kind: "friends"; facts: PersonalFacts; friends: { count: number; traits: readonly FriendFact[] } }
  | { kind: "pair"; pair: { score: number; levelPhrase: string; traits: readonly PairFact[] }; blocks: Record<PairSection, Record<Trait, string>> };

const MIDDLE = 50;

// Чем дальше балл от середины, тем ярче черта; при равенстве сохраняется порядок TRAITS (сортировка устойчивая)
export function byPronounced<T extends { score: number }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => Math.abs(y.score - MIDDLE) - Math.abs(x.score - MIDDLE));
}

const perTrait = <V>(value: (trait: Trait) => V) => Object.fromEntries(TRAITS.map((trait) => [trait, value(trait)])) as Record<Trait, V>;

export function personalFacts(result: PersonalScores): PersonalFacts {
  return {
    typeCode: result.typeCode,
    // Общая форма названия: пол в модель не передаётся
    typeName: typeName(result.typeCode, null),
    stability: result.stability,
    traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], score: result.scores[trait], level: traitLevel(result.scores[trait]) })),
  };
}

export function buildPersonalInput(library: Library, kind: "full" | ChapterKind, result: PersonalScores): ReportInput {
  const facts = personalFacts(result);
  const level = (trait: Trait) => traitLevel(result.scores[trait]);
  if (kind === "full") {
    return {
      kind,
      facts,
      blocks: {
        typeShort: typeTexts(library, result.typeCode).short,
        stability: stabilityText(library, result.stability),
        traits: perTrait((trait) => Object.fromEntries(FULL_SECTIONS.map((section) => [section, traitBlock(library, trait, level(trait), section)])) as Record<FullSection, string>),
      },
    };
  }
  return { kind, facts, blocks: { chapter: CHAPTER_TITLES[kind], traits: perTrait((trait) => traitBlock(library, trait, level(trait), CHAPTER_SECTIONS[kind])) } };
}

export function buildFriendsInput(result: PersonalScores, comparison: FriendComparison): ReportInput {
  return {
    kind: "friends",
    facts: personalFacts(result),
    friends: {
      count: comparison.friendsCount,
      traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], ...comparison.traits[trait] })),
    },
  };
}

export function buildPairInput(library: Library, a: TraitScores, b: TraitScores): ReportInput {
  const variants = pairVariants(a, b);
  const score = compatibilityScore(a, b);
  return {
    kind: "pair",
    pair: {
      score,
      levelPhrase: compatibilityTexts(library, compatibilityLevel(score)).phrase,
      traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], a: a[trait], b: b[trait], variant: variants[trait] })),
    },
    blocks: Object.fromEntries(
      PAIR_SECTIONS.map((section) => [section, perTrait((trait) => pairBlock(library, trait, variants[trait], section))]),
    ) as Record<PairSection, Record<Trait, string>>,
  };
}

export const ALL_PERSONAL_KINDS: readonly ("full" | ChapterKind)[] = ["full", ...CHAPTER_KINDS];
