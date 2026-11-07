import type { TraitScores } from "./traits";

export type TemperamentKey = "sanguine" | "choleric" | "phlegmatic" | "melancholic";

const HIGH = 50;

// Темперамент по осям Айзенка из шкал Big Five: эмоциональность — обратная сторона стабильности.
// Экстраверсия «высокая» от 50, как в тесте; эмоциональность — только при стабильности ниже 50,
// иначе на границе страница результата писала бы «Спокойствие» (stabilityOf) рядом с «Холериком»
export function temperamentFromBigFive(scores: TraitScores): TemperamentKey {
  const extravert = scores.extraversion >= HIGH;
  const emotional = scores.stability < HIGH;
  if (extravert) return emotional ? "choleric" : "sanguine";
  return emotional ? "melancholic" : "phlegmatic";
}
