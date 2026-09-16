# Task 2: Баллы по чертам — `scoreItems`

**Files:**
- Create: `packages/core/src/scoring.ts`
- Test: `packages/core/src/scoring.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `TRAITS`, `Trait`, `TraitScores` из `./traits` (Task 1).
- Produces:
  ```ts
  type Answer = 1 | 2 | 3 | 4 | 5;
  type ItemKey = { readonly id: string; readonly trait: Trait; readonly reversed: boolean };
  type Answers = Readonly<Record<string, Answer>>;
  function scoreItems(items: readonly ItemKey[], answers: Answers): TraitScores;
  class ScoringError extends Error {}
  ```

Одна функция считает и тест о себе (10 вопросов на черту), и анкету друзей или подмножество владельца (4 вопроса на черту): формула `(сумма − n) / (4n) × 100`, округление `Math.round`. Для n = 10 это `(сумма − 10) / 40 × 100`, для n = 4 — `(сумма − 4) / 16 × 100`, как в спецификации. Обратный вопрос даёт `6 − ответ`.

Ошибки — это ошибки программы, а не пользователя (набор вопросов и валидация ответов живут выше), поэтому функция бросает `ScoringError`, если у черты нет вопросов, если на вопрос нет ответа или ответ вне 1–5.

- [ ] **Step 1: Тест (падает)**

`packages/core/src/scoring.test.ts`:
```ts
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
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/scoring.test.ts
```
Expected: FAIL — `Failed to resolve import "./scoring"`.

- [ ] **Step 3: Реализация**

`packages/core/src/scoring.ts`:
```ts
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
```

`packages/core/src/index.ts`:
```ts
export * from "./traits";
export * from "./scoring";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/scoring.ts packages/core/src/scoring.test.ts packages/core/src/index.ts
git commit -m "feat(core): trait scores 0–100 from item keys"
```
