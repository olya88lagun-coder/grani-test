# Task 5: Совместимость пары, уровни и варианты по чертам

**Files:**
- Create: `packages/core/src/compatibility.ts`
- Test: `packages/core/src/compatibility.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Trait`, `TraitScores` из `./traits` (Task 1).
- Produces:
  ```ts
  const RESOURCE_TRAITS: readonly ["agreeableness", "stability"];
  const SIMILARITY_TRAITS: readonly ["openness", "extraversion", "conscientiousness"];
  const PAIR_DIFF_THRESHOLD = 25;
  type CompatibilityLevel = "excellent" | "high" | "good" | "effort" | "challenging";
  const COMPATIBILITY_LEVELS: readonly { readonly min: number; readonly level: CompatibilityLevel }[]; // по убыванию min
  type PairVariant = "both_high" | "both_low" | "different";
  function compatibilityScore(a: TraitScores, b: TraitScores): number; // целое 0–100
  function compatibilityLevel(score: number): CompatibilityLevel;
  function pairVariant(a: number, b: number): PairVariant;
  function pairVariants(a: TraitScores, b: TraitScores): Readonly<Record<Trait, PairVariant>>;
  ```

Формула из раздела 4.6 спецификации: ресурс пары — среднее доброжелательности и стабильности обоих (4 значения); схожесть — среднее `100 − |a − b|` по открытости, экстраверсии и добросовестности; итог `round(0.5 × ресурс + 0.5 × схожесть)`.

Уровни: 85–100 `excellent`, 75–84 `high`, 60–74 `good`, 45–59 `effort`, 0–44 `challenging`. Тексты уровней — в `packages/content` (план 2).

Вариант пары по черте: разница больше 25 — `different`; иначе по среднему паре: ≥ 50 — `both_high`, < 50 — `both_low`. Это совпадает со спецификацией («оба ≥ 50» и «оба < 50» при разнице ≤ 25) и покрывает смешанные случаи вроде 52 и 40.

- [ ] **Step 1: Тест (падает)**

`packages/core/src/compatibility.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { TRAITS, type TraitScores } from "./traits";
import { compatibilityLevel, compatibilityScore, pairVariant, pairVariants } from "./compatibility";

function uniform(value: number): TraitScores {
  return Object.fromEntries(TRAITS.map((trait) => [trait, value])) as TraitScores;
}

describe("compatibilityScore", () => {
  test("is 100 for two identical profiles with maximal agreeableness and stability", () => {
    expect(compatibilityScore(uniform(100), uniform(100))).toBe(100);
  });

  test("is 50 for two identical profiles with zero agreeableness and stability", () => {
    expect(compatibilityScore(uniform(0), uniform(0))).toBe(50);
  });

  test("is 25 for opposite extreme profiles", () => {
    expect(compatibilityScore(uniform(100), uniform(0))).toBe(25);
  });

  test("combines resource and similarity with equal weights", () => {
    const a: TraitScores = { openness: 80, conscientiousness: 60, extraversion: 30, agreeableness: 70, stability: 40 };
    const b: TraitScores = { openness: 50, conscientiousness: 70, extraversion: 40, agreeableness: 90, stability: 60 };
    // ресурс: (70 + 90 + 40 + 60) / 4 = 65
    // схожесть: (70 + 90 + 90) / 3 = 83.33
    // итог: 0.5 × 65 + 0.5 × 83.33 = 74.17 → 74

    expect(compatibilityScore(a, b)).toBe(74);
  });

  test("is symmetric", () => {
    const a: TraitScores = { openness: 12, conscientiousness: 97, extraversion: 55, agreeableness: 31, stability: 68 };
    const b: TraitScores = { openness: 76, conscientiousness: 40, extraversion: 3, agreeableness: 88, stability: 21 };

    expect(compatibilityScore(a, b)).toBe(compatibilityScore(b, a));
  });
});

describe("compatibilityLevel", () => {
  test.each([
    [0, "challenging"],
    [44, "challenging"],
    [45, "effort"],
    [59, "effort"],
    [60, "good"],
    [74, "good"],
    [75, "high"],
    [84, "high"],
    [85, "excellent"],
    [100, "excellent"],
  ] as const)("%i → %s", (score, expected) => {
    expect(compatibilityLevel(score)).toBe(expected);
  });
});

describe("pairVariant", () => {
  test.each([
    [60, 85, "both_high"], // разница 25 — ещё не «разные»
    [60, 86, "different"], // разница 26
    [86, 60, "different"],
    [50, 50, "both_high"],
    [49, 49, "both_low"],
    [52, 40, "both_low"], // смешанный случай: среднее 46
    [40, 65, "both_high"], // смешанный случай: среднее 52.5
  ] as const)("%i and %i → %s", (a, b, expected) => {
    expect(pairVariant(a, b)).toBe(expected);
  });
});

describe("pairVariants", () => {
  test("returns a variant for every trait", () => {
    const a: TraitScores = { openness: 90, conscientiousness: 30, extraversion: 60, agreeableness: 20, stability: 70 };
    const b: TraitScores = { openness: 20, conscientiousness: 35, extraversion: 70, agreeableness: 25, stability: 50 };

    expect(pairVariants(a, b)).toEqual({
      openness: "different",
      conscientiousness: "both_low",
      extraversion: "both_high",
      agreeableness: "both_low",
      stability: "both_high",
    });
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/compatibility.test.ts
```
Expected: FAIL — `Failed to resolve import "./compatibility"`.

- [ ] **Step 3: Реализация**

`packages/core/src/compatibility.ts`:
```ts
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
```

`packages/core/src/index.ts`:
```ts
export * from "./traits";
export * from "./scoring";
export * from "./types";
export * from "./friends";
export * from "./compatibility";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/compatibility.ts packages/core/src/compatibility.test.ts packages/core/src/index.ts
git commit -m "feat(core): couple compatibility score, levels and pair variants"
```
