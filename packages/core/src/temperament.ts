import type { TraitScores } from "./traits";

export type TemperamentKey = "sanguine" | "choleric" | "phlegmatic" | "melancholic";

const HIGH = 50;

// Темперамент по осям Айзенка из шкал Big Five: эмоциональность — обратная сторона стабильности.
// Правила те же, что у теста темперамента: ось «высокая» от 50
export function temperamentFromBigFive(scores: TraitScores): TemperamentKey {
  const extravert = scores.extraversion >= HIGH;
  const emotional = 100 - scores.stability >= HIGH;
  if (extravert) return emotional ? "choleric" : "sanguine";
  return emotional ? "melancholic" : "phlegmatic";
}
