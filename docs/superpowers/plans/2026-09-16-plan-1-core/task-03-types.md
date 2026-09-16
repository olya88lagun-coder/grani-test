# Task 3: Типы, уточнение, пограничность и уровни черт

**Files:**
- Create: `packages/core/src/types.ts`
- Test: `packages/core/src/types.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Trait`, `TraitScores` из `./traits` (Task 1).
- Produces:
  ```ts
  type Pole = "+" | "-";
  type TypeCode = `${Pole}${Pole}${Pole}${Pole}`; // порядок: openness, conscientiousness, extraversion, agreeableness
  type Stability = "calm" | "sensitive";
  type TraitLevel = "high" | "low" | "borderline";
  type Gender = "female" | "male" | null;
  const TYPE_TRAITS: readonly ["openness", "conscientiousness", "extraversion", "agreeableness"];
  const TYPE_THRESHOLD = 50;
  const BORDERLINE_MIN = 45;
  const BORDERLINE_MAX = 55;
  const ALL_TYPE_CODES: readonly TypeCode[]; // 16 кодов, от "++++" до "----"
  const TYPE_NAMES: Readonly<Record<TypeCode, { readonly name: string; readonly feminine: string | null }>>;
  function typeCodeOf(scores: TraitScores): TypeCode;
  function stabilityOf(scores: TraitScores): Stability;
  function isBorderline(score: number): boolean;
  function traitLevel(score: number): TraitLevel;
  function typeName(code: TypeCode, gender: Gender): string;
  ```

Названия — из таблицы раздела 3.2 спецификации. Они черновые и могут поменяться на этапе текстов (план 2); тест проверяет полноту таблицы и выбор формы, а не конкретные слова, кроме двух примеров.

- [ ] **Step 1: Тест (падает)**

`packages/core/src/types.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import type { TraitScores } from "./traits";
import {
  ALL_TYPE_CODES,
  isBorderline,
  stabilityOf,
  TYPE_NAMES,
  traitLevel,
  typeCodeOf,
  typeName,
} from "./types";

function scores(overrides: Partial<Record<keyof TraitScores, number>> = {}): TraitScores {
  return { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50, ...overrides };
}

describe("typeCodeOf", () => {
  test("orders poles as openness, conscientiousness, extraversion, agreeableness", () => {
    const code = typeCodeOf(scores({ openness: 80, conscientiousness: 20, extraversion: 70, agreeableness: 10 }));

    expect(code).toBe("+-+-");
  });

  test("treats 50 as the high pole and 49 as the low pole", () => {
    expect(typeCodeOf(scores({ openness: 50, conscientiousness: 49, extraversion: 50, agreeableness: 49 }))).toBe("+-+-");
  });

  test("ignores stability", () => {
    expect(typeCodeOf(scores({ stability: 0 }))).toBe(typeCodeOf(scores({ stability: 100 })));
  });
});

describe("stabilityOf", () => {
  test("is calm from 50 and sensitive below 50", () => {
    expect(stabilityOf(scores({ stability: 50 }))).toBe("calm");
    expect(stabilityOf(scores({ stability: 49 }))).toBe("sensitive");
  });
});

describe("isBorderline", () => {
  test.each([
    [44, false],
    [45, true],
    [50, true],
    [55, true],
    [56, false],
  ] as const)("%i → %s", (score, expected) => {
    expect(isBorderline(score)).toBe(expected);
  });
});

describe("traitLevel", () => {
  test.each([
    [0, "low"],
    [44, "low"],
    [45, "borderline"],
    [55, "borderline"],
    [56, "high"],
    [100, "high"],
  ] as const)("%i → %s", (score, expected) => {
    expect(traitLevel(score)).toBe(expected);
  });
});

describe("type names", () => {
  test("has exactly 16 distinct codes, each with a name", () => {
    expect(new Set(ALL_TYPE_CODES).size).toBe(16);
    for (const code of ALL_TYPE_CODES) expect(TYPE_NAMES[code].name.length).toBeGreaterThan(0);
    expect(Object.keys(TYPE_NAMES).sort()).toEqual([...ALL_TYPE_CODES].sort());
  });

  test("maps the spec examples", () => {
    expect(TYPE_NAMES["+-++"].name).toBe("Искра");
    expect(TYPE_NAMES["-+-+"].name).toBe("Тихий хранитель");
  });

  test("uses the feminine form for female users when it exists", () => {
    expect(typeName("+--+", "female")).toBe("Мечтательница");
    expect(typeName("+--+", "male")).toBe("Мечтатель");
    expect(typeName("+--+", null)).toBe("Мечтатель");
  });

  test("falls back to the base name when there is no feminine form", () => {
    expect(typeName("+-++", "female")).toBe("Искра");
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/types.test.ts
```
Expected: FAIL — `Failed to resolve import "./types"`.

- [ ] **Step 3: Реализация**

`packages/core/src/types.ts`:
```ts
import type { TraitScores } from "./traits";

export type Pole = "+" | "-";
export type TypeCode = `${Pole}${Pole}${Pole}${Pole}`;
export type Stability = "calm" | "sensitive";
export type TraitLevel = "high" | "low" | "borderline";
export type Gender = "female" | "male" | null;

export const TYPE_TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness"] as const;
export const TYPE_THRESHOLD = 50;
export const BORDERLINE_MIN = 45;
export const BORDERLINE_MAX = 55;

type TypeNameEntry = { readonly name: string; readonly feminine: string | null };

export const TYPE_NAMES: Readonly<Record<TypeCode, TypeNameEntry>> = {
  "++++": { name: "Вдохновитель", feminine: "Вдохновительница" },
  "+++-": { name: "Реформатор", feminine: "Реформаторка" },
  "++-+": { name: "Садовник", feminine: "Садовница" },
  "++--": { name: "Архитектор", feminine: null },
  "+-++": { name: "Искра", feminine: null },
  "+-+-": { name: "Бунтарь", feminine: "Бунтарка" },
  "+--+": { name: "Мечтатель", feminine: "Мечтательница" },
  "+---": { name: "Изобретатель", feminine: "Изобретательница" },
  "-+++": { name: "Опора", feminine: null },
  "-++-": { name: "Командир", feminine: null },
  "-+-+": { name: "Тихий хранитель", feminine: "Тихая хранительница" },
  "-+--": { name: "Мастер", feminine: null },
  "--++": { name: "Душа компании", feminine: null },
  "--+-": { name: "Игрок", feminine: null },
  "---+": { name: "Тихая гавань", feminine: null },
  "----": { name: "Наблюдатель", feminine: null },
};

export const ALL_TYPE_CODES = Object.keys(TYPE_NAMES) as readonly TypeCode[];

function pole(score: number): Pole {
  return score >= TYPE_THRESHOLD ? "+" : "-";
}

export function typeCodeOf(scores: TraitScores): TypeCode {
  return TYPE_TRAITS.map((trait) => pole(scores[trait])).join("") as TypeCode;
}

export function stabilityOf(scores: TraitScores): Stability {
  return scores.stability >= TYPE_THRESHOLD ? "calm" : "sensitive";
}

export function isBorderline(score: number): boolean {
  return score >= BORDERLINE_MIN && score <= BORDERLINE_MAX;
}

export function traitLevel(score: number): TraitLevel {
  if (score > BORDERLINE_MAX) return "high";
  if (score < BORDERLINE_MIN) return "low";
  return "borderline";
}

export function typeName(code: TypeCode, gender: Gender): string {
  const entry = TYPE_NAMES[code];
  return gender === "female" && entry.feminine !== null ? entry.feminine : entry.name;
}
```

`packages/core/src/index.ts`:
```ts
export * from "./traits";
export * from "./scoring";
export * from "./types";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/types.ts packages/core/src/types.test.ts packages/core/src/index.ts
git commit -m "feat(core): type codes, stability, borderline scores and type names"
```
