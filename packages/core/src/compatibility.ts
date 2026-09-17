import { TRAITS, type Trait, type TraitScores } from "./traits";

export const RESOURCE_TRAITS = ["agreeableness", "stability"] as const;
export const SIMILARITY_TRAITS = ["openness", "extraversion", "conscientiousness"] as const;
export const PAIR_DIFF_THRESHOLD = 25;

const RESOURCE_WEIGHT = 0.5;
const SIMILARITY_WEIGHT = 0.5;
const MAX_SCORE = 100;
const HIGH_POLE_MIN = 50;

export type CompatibilityLevel = "excellent" | "high" | "good" | "effort" | "challenging";

export const COMPATIBILITY_LEVELS: readonly { readonly min: number; readonly level: CompatibilityLevel }[] = [
  { min: 85, level: "excellent" },
  { min: 75, level: "high" },
  { min: 60, level: "good" },
  { min: 45, level: "effort" },
  { min: 0, level: "challenging" },
];

export type PairVariant = "both_high" | "both_low" | "different";

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function compatibilityScore(a: TraitScores, b: TraitScores): number {
  const resource = mean(RESOURCE_TRAITS.flatMap((trait) => [a[trait], b[trait]]));
  const similarity = mean(SIMILARITY_TRAITS.map((trait) => MAX_SCORE - Math.abs(a[trait] - b[trait])));
  return Math.round(RESOURCE_WEIGHT * resource + SIMILARITY_WEIGHT * similarity);
}

export function compatibilityLevel(score: number): CompatibilityLevel {
  const found = COMPATIBILITY_LEVELS.find((entry) => score >= entry.min);
  return found?.level ?? "challenging";
}

export function pairVariant(a: number, b: number): PairVariant {
  if (Math.abs(a - b) > PAIR_DIFF_THRESHOLD) return "different";
  return (a + b) / 2 >= HIGH_POLE_MIN ? "both_high" : "both_low";
}

export function pairVariants(a: TraitScores, b: TraitScores): Readonly<Record<Trait, PairVariant>> {
  return Object.fromEntries(TRAITS.map((trait) => [trait, pairVariant(a[trait], b[trait])] as const)) as Record<
    Trait,
    PairVariant
  >;
}
