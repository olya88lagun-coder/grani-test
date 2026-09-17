import { TRAITS, type Trait, type TraitScores } from "./traits";

export type Answer = 1 | 2 | 3 | 4 | 5;

export type ItemKey = { readonly id: string; readonly trait: Trait; readonly reversed: boolean };

export type Answers = Readonly<Record<string, Answer>>;

export class ScoringError extends Error {
  override name = "ScoringError";
}

const MIN_ANSWER = 1;
const MAX_ANSWER = 5;

function keyedValue(item: ItemKey, answers: Answers): number {
  const answer = answers[item.id];
  if (answer === undefined) throw new ScoringError(`No answer for item ${item.id}`);
  if (!Number.isInteger(answer) || answer < MIN_ANSWER || answer > MAX_ANSWER) {
    throw new ScoringError(`Answer for item ${item.id} is outside ${MIN_ANSWER}–${MAX_ANSWER}: ${answer}`);
  }
  return item.reversed ? MAX_ANSWER + MIN_ANSWER - answer : answer;
}

function traitScore(trait: Trait, items: readonly ItemKey[], answers: Answers): number {
  const traitItems = items.filter((item) => item.trait === trait);
  const count = traitItems.length;
  if (count === 0) throw new ScoringError(`No items for trait ${trait}`);
  const sum = traitItems.reduce((total, item) => total + keyedValue(item, answers), 0);
  const range = (MAX_ANSWER - MIN_ANSWER) * count;
  return Math.round(((sum - MIN_ANSWER * count) / range) * 100);
}

export function scoreItems(items: readonly ItemKey[], answers: Answers): TraitScores {
  const entries = TRAITS.map((trait) => [trait, traitScore(trait, items, answers)] as const);
  return Object.fromEntries(entries) as Record<Trait, number>;
}
