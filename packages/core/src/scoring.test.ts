import { describe, expect, test } from "vitest";
import { TRAITS, type Trait } from "./traits";
import { scoreItems, ScoringError, type Answer, type Answers, type ItemKey } from "./scoring";

function itemsPerTrait(count: number, withReversed = true): ItemKey[] {
  return TRAITS.flatMap((trait) =>
    Array.from({ length: count }, (_, i) => ({ id: `${trait}-${i}`, trait, reversed: withReversed && i % 2 === 1 })),
  );
}

function answerAll(items: readonly ItemKey[], pick: (item: ItemKey) => Answer): Answers {
  return Object.fromEntries(items.map((item) => [item.id, pick(item)]));
}

describe("scoreItems", () => {
  test("gives 100 when every answer agrees with the key and 0 when every answer opposes it", () => {
    const items = itemsPerTrait(10);

    const max = scoreItems(items, answerAll(items, (item) => (item.reversed ? 1 : 5)));
    const min = scoreItems(items, answerAll(items, (item) => (item.reversed ? 5 : 1)));

    for (const trait of TRAITS) {
      expect(max[trait]).toBe(100);
      expect(min[trait]).toBe(0);
    }
  });

  test("gives 50 when every answer is neutral", () => {
    const items = itemsPerTrait(10);

    const scores = scoreItems(items, answerAll(items, () => 3));

    for (const trait of TRAITS) expect(scores[trait]).toBe(50);
  });

  test("reverses reversed items as 6 minus the answer", () => {
    const items: ItemKey[] = TRAITS.flatMap((trait) => [
      { id: `${trait}-a`, trait, reversed: false },
      { id: `${trait}-b`, trait, reversed: true },
    ]);
    // openness: 5 и обратный 2 → 5 + 4 = 9; n = 2 → (9 − 2) / 8 × 100 = 87.5 → 88
    const answers = answerAll(items, (item) => (item.trait === "openness" ? (item.reversed ? 2 : 5) : 3));

    const scores = scoreItems(items, answers);

    expect(scores.openness).toBe(88);
    expect(scores.stability).toBe(50);
  });

  test("uses (sum − 10) / 40 × 100 for ten items per trait", () => {
    const items = itemsPerTrait(10, false); // без обратных
    // сумма по чертам: 5×4 + 5×3 = 35 → (35 − 10) / 40 × 100 = 62.5 → 63
    const answers = answerAll(items, (item) => (Number(item.id.split("-")[1]) < 5 ? 4 : 3));

    const scores = scoreItems(items, answers);

    expect(scores.conscientiousness).toBe(63);
  });

  test("uses (sum − 4) / 16 × 100 for four items per trait", () => {
    const items = itemsPerTrait(4, false);
    // сумма 4 + 4 + 3 + 2 = 13 → (13 − 4) / 16 × 100 = 56.25 → 56
    const values: Answer[] = [4, 4, 3, 2];
    const answers = answerAll(items, (item) => values[Number(item.id.split("-")[1])] ?? 3);

    const scores = scoreItems(items, answers);

    expect(scores.agreeableness).toBe(56);
  });

  test("does not mutate its inputs", () => {
    const items = itemsPerTrait(4);
    const answers = answerAll(items, () => 4);
    const itemsCopy = structuredClone(items);
    const answersCopy = structuredClone(answers);

    scoreItems(items, answers);

    expect(items).toEqual(itemsCopy);
    expect(answers).toEqual(answersCopy);
  });

  test("throws when a trait has no items", () => {
    const items = itemsPerTrait(4).filter((item) => item.trait !== ("extraversion" satisfies Trait));

    expect(() => scoreItems(items, answerAll(items, () => 3))).toThrow(ScoringError);
  });

  test("throws when an item has no answer", () => {
    const items = itemsPerTrait(4);
    const answers = answerAll(items.slice(1), () => 3);

    expect(() => scoreItems(items, answers)).toThrow(/openness-0/);
  });

  test("throws when an answer is outside 1–5", () => {
    const items = itemsPerTrait(4);
    const answers = { ...answerAll(items, () => 3), "stability-2": 7 } as unknown as Answers;

    expect(() => scoreItems(items, answers)).toThrow(ScoringError);
  });
});
