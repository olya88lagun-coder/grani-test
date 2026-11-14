import { scoreItems, type Answers, type ItemKey } from "@grani/core";
import { familyForScores } from "./type-visuals";

export function previewFamily(items: readonly ItemKey[], answers: Answers) {
  // Unanswered items sit at the midpoint. A partial family can still change.
  const neutral = { ...answers };
  for (const { id } of items) neutral[id] ??= 3;
  return familyForScores(scoreItems(items, neutral));
}
