# Task 4: Сравнение с друзьями

**Files:**
- Create: `packages/core/src/friends.ts`
- Test: `packages/core/src/friends.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `TRAITS`, `Trait`, `TraitScores` из `./traits` (Task 1).
- Produces:
  ```ts
  const MIN_FRIENDS = 3;
  const FRIEND_DIFF_THRESHOLD = 15;
  type TraitComparison = { readonly self: number; readonly friends: number; readonly diff: number; readonly notable: boolean };
  type FriendComparison = {
    readonly friendsCount: number;
    readonly average: TraitScores;
    readonly traits: Readonly<Record<Trait, TraitComparison>>;
  };
  function averageScores(list: readonly TraitScores[]): TraitScores;
  function compareWithFriends(selfSubset: TraitScores, friends: readonly TraitScores[]): FriendComparison | null;
  ```

`selfSubset` — баллы владельца, посчитанные `scoreItems` только по тем 20 вопросам, что заданы друзьям (раздел 3.3 спецификации); подбор подмножества — задача вызывающего кода в плане 4. `diff = friends − self`: положительная разница значит «друзья видят черту сильнее». Среднее друзей округляется до целого до вычисления разницы. При 0–2 ответах функция возвращает `null`, и ни среднее, ни отдельные ответы наружу не попадают — это правило анонимности.

- [ ] **Step 1: Тест (падает)**

`packages/core/src/friends.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import type { TraitScores } from "./traits";
import { averageScores, compareWithFriends, MIN_FRIENDS } from "./friends";

function scores(overrides: Partial<Record<keyof TraitScores, number>> = {}): TraitScores {
  return { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50, ...overrides };
}

describe("averageScores", () => {
  test("rounds the mean of each trait to an integer", () => {
    const average = averageScores([scores({ openness: 61 }), scores({ openness: 70 }), scores({ openness: 66 })]);

    expect(average.openness).toBe(66); // 65.67 → 66
    expect(average.stability).toBe(50);
  });

  test("throws on an empty list", () => {
    expect(() => averageScores([])).toThrow();
  });
});

describe("compareWithFriends", () => {
  test.each([0, 1, 2])("returns null with %i answers", (count) => {
    const friends = Array.from({ length: count }, () => scores({ openness: 90 }));

    expect(compareWithFriends(scores(), friends)).toBeNull();
  });

  test("is available from exactly MIN_FRIENDS answers", () => {
    const friends = Array.from({ length: MIN_FRIENDS }, () => scores());

    expect(compareWithFriends(scores(), friends)?.friendsCount).toBe(3);
  });

  test("marks a difference of 15 as not notable and 16 as notable", () => {
    const self = scores();
    const friends = [
      scores({ openness: 60, extraversion: 61 }),
      scores({ openness: 70, extraversion: 70 }),
      scores({ openness: 65, extraversion: 66 }),
    ];

    const result = compareWithFriends(self, friends);

    expect(result?.traits.openness).toEqual({ self: 50, friends: 65, diff: 15, notable: false });
    expect(result?.traits.extraversion).toEqual({ self: 50, friends: 66, diff: 16, notable: true });
  });

  test("treats negative differences by absolute value", () => {
    const friends = [scores({ agreeableness: 30 }), scores({ agreeableness: 30 }), scores({ agreeableness: 36 })];

    const result = compareWithFriends(scores({ agreeableness: 50 }), friends);

    expect(result?.traits.agreeableness).toEqual({ self: 50, friends: 32, diff: -18, notable: true });
  });

  test("exposes only the rounded average, not individual answers", () => {
    const friends = [scores({ stability: 10 }), scores({ stability: 20 }), scores({ stability: 90 })];

    const result = compareWithFriends(scores(), friends);

    expect(Object.keys(result ?? {}).sort()).toEqual(["average", "friendsCount", "traits"]);
    expect(result?.average.stability).toBe(40);
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/friends.test.ts
```
Expected: FAIL — `Failed to resolve import "./friends"`.

- [ ] **Step 3: Реализация**

`packages/core/src/friends.ts`:
```ts
import { TRAITS, type Trait, type TraitScores } from "./traits";

export const MIN_FRIENDS = 3;
export const FRIEND_DIFF_THRESHOLD = 15;

export type TraitComparison = {
  readonly self: number;
  readonly friends: number;
  readonly diff: number;
  readonly notable: boolean;
};

export type FriendComparison = {
  readonly friendsCount: number;
  readonly average: TraitScores;
  readonly traits: Readonly<Record<Trait, TraitComparison>>;
};

export function averageScores(list: readonly TraitScores[]): TraitScores {
  if (list.length === 0) throw new Error("Cannot average an empty list of scores");
  const entries = TRAITS.map((trait) => {
    const sum = list.reduce((total, item) => total + item[trait], 0);
    return [trait, Math.round(sum / list.length)] as const;
  });
  return Object.fromEntries(entries) as Record<Trait, number>;
}

function compareTrait(self: number, friends: number): TraitComparison {
  const diff = friends - self;
  return { self, friends, diff, notable: Math.abs(diff) > FRIEND_DIFF_THRESHOLD };
}

export function compareWithFriends(
  selfSubset: TraitScores,
  friends: readonly TraitScores[],
): FriendComparison | null {
  if (friends.length < MIN_FRIENDS) return null;
  const average = averageScores(friends);
  const traits = Object.fromEntries(
    TRAITS.map((trait) => [trait, compareTrait(selfSubset[trait], average[trait])] as const),
  ) as Record<Trait, TraitComparison>;
  return { friendsCount: friends.length, average, traits };
}
```

`packages/core/src/index.ts`:
```ts
export * from "./traits";
export * from "./scoring";
export * from "./types";
export * from "./friends";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/friends.ts packages/core/src/friends.test.ts packages/core/src/index.ts
git commit -m "feat(core): compare self scores with friends' average"
```
