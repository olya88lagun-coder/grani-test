# Task 3: `packages/ai` — схемы разделов, вход из блоков, разбор без ИИ

**Files:**
- Create: `packages/ai/package.json`, `packages/ai/tsconfig.json`, `packages/ai/vitest.config.ts`, `packages/ai/src/index.ts`
- Create: `packages/ai/src/sections.ts`, `sections.test.ts`, `packages/ai/src/input.ts`, `input.test.ts`, `packages/ai/src/fallback.ts`, `fallback.test.ts`
- Modify: `vitest.config.ts` (покрытие `packages/ai/src`)

**Interfaces:**
- Consumes: `ReportKind`, `ChapterKind`, `CHAPTER_KINDS`, `TRAITS`, `traitLevel`, `typeName`, `pairVariants`, `compatibilityScore`, `compatibilityLevel`, `FriendComparison`, `TraitScores`, `TypeCode`, `Stability` (`@grani/core`); `Library`, `traitBlock`, `typeTexts`, `stabilityText`, `pairBlock`, `compatibilityTexts`, `PAIR_SECTIONS`, `TRAIT_LABELS`, `CHAPTER_SECTIONS`, `CHAPTER_TITLES` (`@grani/content`, Task 1).
- Produces:
  ```ts
  // sections.ts
  type FullSections = { portrait: string; strengths: string[]; blind_spots: { text: string; tip: string }[]; manual: { work: string[]; fight: string[]; annoys: string[] } };
  type FriendsSections = { text: string };
  type ChapterSections = { text: string; tips: string[] };
  type PairSections = { similar: string; differences: string; conflicts: string; home_money: string; support: string };
  type ReportSections = { full: FullSections; friends: FriendsSections; pair: PairSections } & Record<ChapterKind, ChapterSections>;
  const SECTION_SCHEMAS: { readonly [K in ReportKind]: z.ZodType<ReportSections[K]> };
  function parseSections<K extends ReportKind>(kind: K, value: unknown): ReportSections[K] | null;
  function sectionStrings(value: unknown): string[];

  // input.ts
  type TraitFact = { trait: Trait; label: string; score: number; level: TraitLevel };
  type PersonalFacts = { typeCode: TypeCode; typeName: string; stability: Stability; traits: readonly TraitFact[] };
  type PersonalScores = { scores: TraitScores; typeCode: TypeCode; stability: Stability };
  type ReportInput =
    | { kind: "full"; facts: PersonalFacts; blocks: { typeShort: string; stability: string; traits: Record<Trait, Record<"strengths" | "blind_spots" | "work" | "conflict" | "stress", string>> } }
    | { kind: ChapterKind; facts: PersonalFacts; blocks: { chapter: string; traits: Record<Trait, string> } }
    | { kind: "friends"; facts: PersonalFacts; friends: { count: number; traits: readonly { trait: Trait; label: string; self: number; friends: number; diff: number; notable: boolean }[] } }
    | { kind: "pair"; pair: { score: number; levelPhrase: string; traits: readonly { trait: Trait; label: string; a: number; b: number; variant: PairVariant }[] }; blocks: Record<PairSection, Record<Trait, string>> };
  function byPronounced<T extends { score: number }>(items: readonly T[]): T[];
  function personalFacts(result: PersonalScores): PersonalFacts;
  function buildPersonalInput(library: Library, kind: "full" | ChapterKind, result: PersonalScores): ReportInput;
  function buildFriendsInput(result: PersonalScores, comparison: FriendComparison): ReportInput;
  function buildPairInput(library: Library, a: TraitScores, b: TraitScores): ReportInput;

  // fallback.ts
  function fallbackSections(input: ReportInput): ReportSections[ReportKind];
  ```

Раздел 4.4 спецификации. Вход модели собирается только из баллов и блоков: в нём нет имён, пола и идентификаторов — `typeName` берётся в общей форме (`typeName(code, null)`). Разборы на «ты», разбор пары — на «вы».

Сборка без ИИ должна проходить ту же проверку, что и ответ модели, поэтому пределы длины схем подобраны под блоки библиотеки (блок — до 1500 знаков, `LIMITS.traitBlock`), а тест собирает разбор для всех 32 сочетаний высоких и низких баллов и для «всё на границе» и прогоняет его через `parseSections`.

Правила сборки без ИИ («выраженность» черты — расстояние балла от 50, при равенстве — порядок `TRAITS`):
- **Полный разбор.** Портрет — короткий текст типа и текст уточнения. Сильные стороны — первый пункт блока `strengths` каждой черты (5). Слепые зоны — первый пункт `blind_spots` четырёх самых выраженных черт; пункт делится по «Что с этим делать:» на текст и подсказку. «Как со мной работать» и «Как со мной ссориться» — абзац «Что помогает:» блоков `work` и `conflict` трёх самых выраженных черт. «Что меня бесит» — первое предложение блока `stress` трёх самых выраженных черт.
- **Глава.** Текст — первые абзацы блоков раздела главы (`CHAPTER_SECTIONS`) пяти черт по выраженности. Советы — их абзацы «Что помогает:».
- **Друзья.** Короткое вступление и по строке на каждую черту: для заметной разницы — чьи оценки выше, для остальных — что оценки совпадают.
- **Пара.** Каждый из пяти разделов — блоки пары этого раздела по пяти чертам (вариант пары по черте — `pairVariants`).

- [ ] **Step 1: Пакет**

`packages/ai/package.json`:
```json
{
  "name": "@grani/ai",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@grani/content": "workspace:*",
    "@grani/core": "workspace:*",
    "zod": "4.6.5"
  }
}
```

`packages/ai/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/ai/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "ai", environment: "node" },
});
```

`packages/ai/src/index.ts`:
```ts
export * from "./sections";
export * from "./input";
export * from "./fallback";
```

В корневом `vitest.config.ts` в `coverage.include` добавить `"packages/ai/src/**/*.ts"`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install && pnpm dedupe
```

- [ ] **Step 2: Тесты схем и входа (падают)**

`packages/ai/src/sections.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { parseSections, sectionStrings } from "./sections";

const long = (n: number) => "а".repeat(n);

describe("parseSections", () => {
  test("accepts a complete full report", () => {
    const sections = {
      portrait: long(400),
      strengths: [long(30), long(30), long(30), long(30)],
      blind_spots: [1, 2, 3].map(() => ({ text: long(30), tip: long(30) })),
      manual: { work: [long(20), long(20), long(20)], fight: [long(20), long(20), long(20)], annoys: [long(20), long(20), long(20)] },
    };

    expect(parseSections("full", sections)).toEqual(sections);
  });

  test("rejects missing sections, extra keys and wrong lengths", () => {
    expect(parseSections("friends", {})).toBeNull();
    expect(parseSections("friends", { text: long(300), extra: "x" })).toBeNull();
    expect(parseSections("friends", { text: long(50) })).toBeNull();
    expect(parseSections("chapter_money", { text: long(500), tips: [long(30)] })).toBeNull();
  });
});

test("sectionStrings collects every text for the stop-word check", () => {
  expect(sectionStrings({ a: "x", b: ["y", { c: "z" }], d: 3 })).toEqual(["x", "y", "z"]);
});
```

`packages/ai/src/input.test.ts`:
```ts
import { compareWithFriends } from "@grani/core";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { buildFriendsInput, buildPairInput, buildPersonalInput, byPronounced, personalFacts } from "./input";

const RESULT = {
  scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 },
  typeCode: "+-++",
  stability: "calm",
} as const;

describe("personalFacts", () => {
  test("names the type in the common form and labels every trait with its level", () => {
    const facts = personalFacts(RESULT);

    expect(facts.typeName).toBe("Искра");
    expect(facts.traits[0]).toEqual({ trait: "openness", label: "Открытость опыту", score: 80, level: "high" });
    expect(facts.traits.map((fact) => fact.level)).toEqual(["high", "low", "high", "high", "borderline"]);
  });

  test("orders traits by how far the score is from the middle", () => {
    expect(byPronounced(personalFacts(RESULT).traits).map((fact) => fact.trait)).toEqual([
      "openness",
      "extraversion",
      "agreeableness",
      "conscientiousness",
      "stability",
    ]);
  });
});

describe("inputs", () => {
  test("the full report takes the blocks of each trait's level and no personal data", () => {
    const input = buildPersonalInput(getLibrary(), "full", RESULT);

    expect(input.kind).toBe("full");
    if (input.kind !== "full") return;
    expect(input.blocks.traits.openness.strengths).toContain("новое");
    expect(JSON.stringify(input)).not.toMatch(/displayName|userId|resultId|female|male/);
  });

  test("a chapter takes its section for all five traits", () => {
    const input = buildPersonalInput(getLibrary(), "chapter_money", RESULT);

    expect(input.kind === "chapter_money" && input.blocks.chapter).toBe("Деньги");
    expect(input.kind === "chapter_money" && Object.keys(input.blocks.traits)).toHaveLength(5);
  });

  test("friends input carries the comparison per trait", () => {
    const self = RESULT.scores;
    const comparison = compareWithFriends(self, [self, self, { ...self, openness: 20 }])!;

    const input = buildFriendsInput(RESULT, comparison);

    expect(input.kind === "friends" && input.friends.count).toBe(3);
    expect(input.kind === "friends" && input.friends.traits.find((fact) => fact.trait === "openness")).toMatchObject({ self: 80, friends: 60, diff: -20, notable: true });
  });

  test("pair input has the score, variants and blocks of every section", () => {
    const b = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

    const input = buildPairInput(getLibrary(), RESULT.scores, b);

    expect(input.kind).toBe("pair");
    if (input.kind !== "pair") return;
    expect(input.pair.traits.find((fact) => fact.trait === "openness")).toMatchObject({ a: 80, b: 45, variant: "different" });
    expect(Object.keys(input.blocks)).toEqual(["similar", "differences", "conflicts", "home_money", "support"]);
    expect(input.pair.levelPhrase.length).toBeGreaterThan(10);
  });
});
```

```bash
pnpm vitest run packages/ai
```
Expected: FAIL — модулей нет.

- [ ] **Step 3: Схемы и вход**

`packages/ai/src/sections.ts`:
```ts
import type { ChapterKind, ReportKind } from "@grani/core";
import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const list = (item: z.ZodType<string>, min: number, max: number) => z.array(item).min(min).max(max);

// Пределы подобраны так, чтобы в них помещалась и сборка из блоков (блок библиотеки — до 1500 знаков)
const FullSchema = z.strictObject({
  portrait: text(300, 2500),
  strengths: list(text(20, 800), 4, 5),
  blind_spots: z.array(z.strictObject({ text: text(20, 800), tip: text(20, 800) })).min(3).max(4),
  manual: z.strictObject({
    work: list(text(10, 1500), 3, 4),
    fight: list(text(10, 1500), 3, 4),
    annoys: list(text(10, 800), 3, 4),
  }),
});
const FriendsSchema = z.strictObject({ text: text(200, 2500) });
const ChapterSchema = z.strictObject({ text: text(300, 8000), tips: list(text(20, 1500), 3, 5) });
const PairSchema = z.strictObject({
  similar: text(300, 8000),
  differences: text(300, 8000),
  conflicts: text(300, 8000),
  home_money: text(300, 8000),
  support: text(300, 8000),
});

export type FullSections = z.infer<typeof FullSchema>;
export type FriendsSections = z.infer<typeof FriendsSchema>;
export type ChapterSections = z.infer<typeof ChapterSchema>;
export type PairSections = z.infer<typeof PairSchema>;
export type ReportSections = { full: FullSections; friends: FriendsSections; pair: PairSections } & Record<ChapterKind, ChapterSections>;

export const SECTION_SCHEMAS: { readonly [K in ReportKind]: z.ZodType<ReportSections[K]> } = {
  full: FullSchema,
  friends: FriendsSchema,
  chapter_money: ChapterSchema,
  chapter_conflict: ChapterSchema,
  chapter_stress: ChapterSchema,
  chapter_relationships: ChapterSchema,
  pair: PairSchema,
};

export function parseSections<K extends ReportKind>(kind: K, value: unknown): ReportSections[K] | null {
  const parsed = SECTION_SCHEMAS[kind].safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sectionStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sectionStrings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(sectionStrings);
  return [];
}
```

`packages/ai/src/input.ts`:
```ts
import {
  CHAPTER_KINDS,
  compatibilityLevel,
  compatibilityScore,
  pairVariants,
  TRAITS,
  traitLevel,
  typeName,
  type ChapterKind,
  type FriendComparison,
  type PairVariant,
  type Stability,
  type Trait,
  type TraitLevel,
  type TraitScores,
  type TypeCode,
} from "@grani/core";
import {
  CHAPTER_SECTIONS,
  CHAPTER_TITLES,
  compatibilityTexts,
  pairBlock,
  PAIR_SECTIONS,
  stabilityText,
  TRAIT_LABELS,
  traitBlock,
  typeTexts,
  type Library,
  type PairSection,
} from "@grani/content";

export type TraitFact = { trait: Trait; label: string; score: number; level: TraitLevel };
export type PersonalFacts = { typeCode: TypeCode; typeName: string; stability: Stability; traits: readonly TraitFact[] };
export type PersonalScores = { scores: TraitScores; typeCode: TypeCode; stability: Stability };

const FULL_SECTIONS = ["strengths", "blind_spots", "work", "conflict", "stress"] as const;
type FullSection = (typeof FULL_SECTIONS)[number];

export type FriendFact = { trait: Trait; label: string; self: number; friends: number; diff: number; notable: boolean };
export type PairFact = { trait: Trait; label: string; a: number; b: number; variant: PairVariant };

export type ReportInput =
  | { kind: "full"; facts: PersonalFacts; blocks: { typeShort: string; stability: string; traits: Record<Trait, Record<FullSection, string>> } }
  | { kind: ChapterKind; facts: PersonalFacts; blocks: { chapter: string; traits: Record<Trait, string> } }
  | { kind: "friends"; facts: PersonalFacts; friends: { count: number; traits: readonly FriendFact[] } }
  | { kind: "pair"; pair: { score: number; levelPhrase: string; traits: readonly PairFact[] }; blocks: Record<PairSection, Record<Trait, string>> };

const MIDDLE = 50;

// Чем дальше балл от середины, тем ярче черта; при равенстве сохраняется порядок TRAITS (сортировка устойчивая)
export function byPronounced<T extends { score: number }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => Math.abs(y.score - MIDDLE) - Math.abs(x.score - MIDDLE));
}

const perTrait = <V>(value: (trait: Trait) => V) => Object.fromEntries(TRAITS.map((trait) => [trait, value(trait)])) as Record<Trait, V>;

export function personalFacts(result: PersonalScores): PersonalFacts {
  return {
    typeCode: result.typeCode,
    // Общая форма названия: пол в модель не передаётся
    typeName: typeName(result.typeCode, null),
    stability: result.stability,
    traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], score: result.scores[trait], level: traitLevel(result.scores[trait]) })),
  };
}

export function buildPersonalInput(library: Library, kind: "full" | ChapterKind, result: PersonalScores): ReportInput {
  const facts = personalFacts(result);
  const level = (trait: Trait) => traitLevel(result.scores[trait]);
  if (kind === "full") {
    return {
      kind,
      facts,
      blocks: {
        typeShort: typeTexts(library, result.typeCode).short,
        stability: stabilityText(library, result.stability),
        traits: perTrait((trait) => Object.fromEntries(FULL_SECTIONS.map((section) => [section, traitBlock(library, trait, level(trait), section)])) as Record<FullSection, string>),
      },
    };
  }
  return { kind, facts, blocks: { chapter: CHAPTER_TITLES[kind], traits: perTrait((trait) => traitBlock(library, trait, level(trait), CHAPTER_SECTIONS[kind])) } };
}

export function buildFriendsInput(result: PersonalScores, comparison: FriendComparison): ReportInput {
  return {
    kind: "friends",
    facts: personalFacts(result),
    friends: {
      count: comparison.friendsCount,
      traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], ...comparison.traits[trait] })),
    },
  };
}

export function buildPairInput(library: Library, a: TraitScores, b: TraitScores): ReportInput {
  const variants = pairVariants(a, b);
  const score = compatibilityScore(a, b);
  return {
    kind: "pair",
    pair: {
      score,
      levelPhrase: compatibilityTexts(library, compatibilityLevel(score)).phrase,
      traits: TRAITS.map((trait) => ({ trait, label: TRAIT_LABELS[trait], a: a[trait], b: b[trait], variant: variants[trait] })),
    },
    blocks: Object.fromEntries(
      PAIR_SECTIONS.map((section) => [section, perTrait((trait) => pairBlock(library, trait, variants[trait], section))]),
    ) as Record<PairSection, Record<Trait, string>>,
  };
}

export const ALL_PERSONAL_KINDS: readonly ("full" | ChapterKind)[] = ["full", ...CHAPTER_KINDS];
```

`CHAPTER_KINDS` в конце нужен тестам запасной сборки: они перебирают все личные виды разборов.

```bash
pnpm vitest run packages/ai/src/sections.test.ts packages/ai/src/input.test.ts
```
Expected: PASS.

- [ ] **Step 4: Тесты разбора без ИИ (падают)**

`packages/ai/src/fallback.test.ts`:
```ts
import { compareWithFriends, stabilityOf, TRAITS, typeCodeOf, type TraitScores } from "@grani/core";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { fallbackSections } from "./fallback";
import { ALL_PERSONAL_KINDS, buildFriendsInput, buildPairInput, buildPersonalInput } from "./input";
import { parseSections } from "./sections";

// Все 32 сочетания «высокий/низкий» по пяти чертам и профиль «всё на границе»
const PROFILES: TraitScores[] = [
  ...Array.from({ length: 32 }, (_, mask) => Object.fromEntries(TRAITS.map((trait, i) => [trait, mask & (1 << i) ? 80 : 20])) as TraitScores),
  { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 },
];

const personal = (scores: TraitScores) => ({ scores, typeCode: typeCodeOf(scores), stability: stabilityOf(scores) });

describe("fallbackSections", () => {
  test("every personal report of every profile passes the same check as the model", () => {
    for (const scores of PROFILES) {
      for (const kind of ALL_PERSONAL_KINDS) {
        const sections = fallbackSections(buildPersonalInput(getLibrary(), kind, personal(scores)));
        expect(parseSections(kind, sections), `${kind} ${JSON.stringify(scores)}`).not.toBeNull();
      }
    }
  });

  test("the full report splits blind spots into a text and a tip", () => {
    const sections = fallbackSections(buildPersonalInput(getLibrary(), "full", personal(PROFILES[0]!)));

    const full = parseSections("full", sections)!;
    expect(full.strengths).toHaveLength(5);
    expect(full.blind_spots).toHaveLength(4);
    expect(full.blind_spots[0]!.tip).not.toMatch(/^Что с этим делать/);
  });

  test("friends report explains differences and matches", () => {
    const self = PROFILES[31]!;
    const lower = { ...self, openness: 20 };
    const withDifference = compareWithFriends(self, [lower, lower, lower])!;
    const same = compareWithFriends(self, [self, self, self])!;

    const differs = parseSections("friends", fallbackSections(buildFriendsInput(personal(self), withDifference)));
    const matches = parseSections("friends", fallbackSections(buildFriendsInput(personal(self), same)));

    expect(differs?.text).toContain("«Открытость опыту»: друзья ставят тебе 20, ты себе — 80");
    expect(matches?.text).toContain("примерно так же, как ты себя");
  });

  test("pair report passes the check for different pairs", () => {
    for (const [a, b] of [[PROFILES[0]!, PROFILES[31]!], [PROFILES[31]!, PROFILES[31]!], [PROFILES[32]!, PROFILES[5]!]] as const) {
      expect(parseSections("pair", fallbackSections(buildPairInput(getLibrary(), a, b)))).not.toBeNull();
    }
  });
});
```

```bash
pnpm vitest run packages/ai/src/fallback.test.ts
```
Expected: FAIL — нет `./fallback`.

- [ ] **Step 5: Разбор без ИИ**

`packages/ai/src/fallback.ts`:
```ts
import { TRAITS, type Trait } from "@grani/core";
import { PAIR_SECTIONS } from "@grani/content";
import { byPronounced, type PersonalFacts, type ReportInput } from "./input";
import type { ChapterSections, FriendsSections, FullSections, PairSections, ReportSections } from "./sections";
import type { ReportKind } from "@grani/core";

const ADVICE_MARKER = "Что помогает:";
const TIP_MARKER = "Что с этим делать:";
const DEFAULT_TIP = "Замечать это вовремя и договариваться заранее — уже половина дела.";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const paragraphs = (block: string) => block.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
const bullets = (block: string) => block.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim());
const firstBullet = (block: string) => bullets(block)[0] ?? paragraphs(block)[0] ?? block.trim();
const firstParagraph = (block: string) => paragraphs(block)[0] ?? block.trim();
const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;

function advice(block: string): string {
  const found = paragraphs(block).find((part) => part.startsWith(ADVICE_MARKER));
  return capitalize((found ?? paragraphs(block).at(-1) ?? block).replace(ADVICE_MARKER, "").trim());
}

function splitBlindSpot(bullet: string): { text: string; tip: string } {
  const [text, tip] = bullet.split(TIP_MARKER);
  return { text: text!.trim(), tip: tip ? capitalize(tip.trim()) : DEFAULT_TIP };
}

const ordered = (facts: PersonalFacts): Trait[] => byPronounced(facts.traits).map((fact) => fact.trait);

function full(input: Extract<ReportInput, { kind: "full" }>): FullSections {
  const traits = input.blocks.traits;
  const top = ordered(input.facts);
  return {
    portrait: `${input.blocks.typeShort}\n\n${input.blocks.stability}`,
    strengths: top.map((trait) => firstBullet(traits[trait].strengths)),
    blind_spots: top.slice(0, 4).map((trait) => splitBlindSpot(firstBullet(traits[trait].blind_spots))),
    manual: {
      work: top.slice(0, 3).map((trait) => advice(traits[trait].work)),
      fight: top.slice(0, 3).map((trait) => advice(traits[trait].conflict)),
      annoys: top.slice(0, 3).map((trait) => firstSentence(firstParagraph(traits[trait].stress))),
    },
  };
}

function chapter(input: Extract<ReportInput, { kind: `chapter_${string}` }>): ChapterSections {
  const top = ordered(input.facts);
  return {
    text: top.map((trait) => firstParagraph(input.blocks.traits[trait])).join("\n\n"),
    tips: [...new Set(top.map((trait) => advice(input.blocks.traits[trait])))],
  };
}

function friends(input: Extract<ReportInput, { kind: "friends" }>): FriendsSections {
  const lines = input.friends.traits.map((fact) =>
    fact.notable
      ? `«${fact.label}»: друзья ставят тебе ${fact.friends}, ты себе — ${fact.self}. ${fact.diff > 0 ? "Со стороны эта черта заметнее, чем тебе кажется." : "Со стороны эта черта видна слабее, чем тебе кажется."}`
      : `«${fact.label}»: оценки почти совпадают — ${fact.self} у тебя и ${fact.friends} у друзей.`,
  );
  const summary = input.friends.traits.some((fact) => fact.notable)
    ? "Разница — не ошибка теста: люди видят поступки, а ты знаешь ещё и мотивы. Там, где оценки расходятся, полезно спросить друзей, что именно они замечают."
    : "В целом друзья видят тебя примерно так же, как ты себя: то, что ты о себе знаешь, заметно и со стороны.";
  return { text: [`Это среднее по ответам друзей (${input.friends.count}) на те же 20 вопросов, на которые ты отвечаешь о себе в тесте.`, ...lines, summary].join("\n\n") };
}

function pair(input: Extract<ReportInput, { kind: "pair" }>): PairSections {
  return Object.fromEntries(
    PAIR_SECTIONS.map((section) => [section, TRAITS.map((trait) => input.blocks[section][trait]).join("\n\n")]),
  ) as PairSections;
}

export function fallbackSections(input: ReportInput): ReportSections[ReportKind] {
  if (input.kind === "full") return full(input);
  if (input.kind === "friends") return friends(input);
  if (input.kind === "pair") return pair(input);
  return chapter(input);
}
```

Тексты без родовых окончаний, как в плане 4. Тип `Extract<ReportInput, { kind: \`chapter_${string}\` }>` выбирает четыре варианта глав.

В `packages/ai/src/index.ts` экспорт уже есть (Step 1).

- [ ] **Step 6: Запуск и коммит**

```bash
pnpm vitest run packages/ai && pnpm typecheck
```
Expected: PASS. Если какой-то профиль не прошёл проверку, в сообщении теста видно вид разбора и баллы: исправлять сборку или пределы схемы (так, чтобы ответ модели по-прежнему ограничивался разумно), а не пропускать профиль.

```bash
git add packages/ai vitest.config.ts pnpm-lock.yaml
git commit -m "feat(ai): report section schemas, model input from library blocks and a fallback report"
```
