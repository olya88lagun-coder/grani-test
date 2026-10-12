# Chapter Cards Pilot (chapter «Деньги») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выдавать главу «Деньги» в формате карточек (ситуация → почему так → что сказать → что сделать), генерируемых тремя короткими запросами к ИИ, и показывать её читателю; остальные главы и прежний формат работают как раньше.

**Architecture:** В `reports.sections` (jsonb) рядом с форматом 1 `{text, tips}` появляется формат 2 с полем `version: 2`; схема принимает оба. Воркер при `CHAPTER_CARDS_V2=1` и подключённом ИИ делает три параллельных запроса (обзор + две группы тем), проверяет каждый, собирает главу; при любом сбое подставляет прежнюю сборку из блоков. Страница показывает формат 2 новым компонентом `ChapterCards`, формат 1 — прежней разметкой.

**Tech Stack:** TypeScript, zod 4, vitest (корневой `vitest.config.ts`, проекты `packages/*` и `apps/*`), React 19 / Next 16 (`renderToStaticMarkup` в тестах), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-12-chapter-cards-pilot-design.md`

## Global Constraints

- Новый код — по образцу существующего: комментарии на русском и только там, где объясняют «почему»; имена на английском; неизменяемые данные; файлы до 400 строк; функции до 50 строк.
- Нельзя менять прежний формат главы 1 и существующие тесты (меняется только то, что явно названо в задачах).
- Миграции базы не добавляются: формат хранится в `reports.sections`.
- Формат 2: `headline` 40–140 знаков; `summary` 150–500; `situations` 5–6 штук; `others_see` 120–400; `traps` ровно 3. Ситуация: `title` 20–90, `scene` 80–320, `why` 80–320, `traits` 1–2 штуки из пяти черт, `say` 1–3 фразы по 10–160, `do` 40–260.
- Не более одной оговорки («может», «могут», «возможно», «вероятно», «можно сравнить») на карточку ситуации.
- Запрещены фразы-пустышки и утверждения о прошлом читателя («ты уже», «у тебя было», «у тебя уже», «ты всегда», «ты никогда»).
- Стоп-слова (`findStopWords`) проверяются во всех строках ответа.
- 3 попытки на каждую часть, таймаут 60 с (константы `GENERATION_ATTEMPTS`, `GENERATION_TIMEOUT_MS`); при сбое любой части глава собирается прежним `fallbackSections` и сохраняется с `source = "fallback"`.
- Генерация формата 2 включена только при `CHAPTER_CARDS_V2=1`, только для `chapter_money`, только при непустом `writer`. Без флага поведение воркера не меняется.
- Цвета нового компонента — собственные переменные `--cc-*` внутри `ChapterCards.module.css`; переменные `--ink`, `--gold`, `--paper` из других тем не использовать (из-за их смешения возникла ошибка контраста во вкладке «Пять граней»).
- Контраст текста в `ChapterCards` не ниже 4,5 : 1 (фон карточки `#102a21`, текст `#f1ecdf`, второстепенный `#b9c4b8`, акцент `#d4b878`).
- Коммиты: `<type>: <description>` (feat, fix, refactor, docs, test, chore); без строки Co-Authored-By.

## Review Focus

- Прежние главы формата 1 (без `version`) должны по-прежнему открываться в трёх местах: обычная страница разбора, вкладка «4 сферы» в `PersonalEdition`, страница практики `/report/[id]/practice/money` — тесты `ChapterReading` и страницы разбора (Task 7), для страницы практики — typecheck и ручная проверка (Task 8).
- Модель вернула валидный JSON, но обёрнутый пояснением или блоком Markdown: часть должна приниматься (Task 3).
- Модель вернула темы не в том порядке, с пропуском или дублем `seed`: часть отклоняется и повторяется (Task 3).
- Одна часть «зависла» по таймауту, остальные ответили: в базу не попадает «полуглава», сохраняется прежняя сборка (Task 4 и Task 5).
- Текст от модели с HTML (`<script>`) выводится экранированным (Task 6).

---

### Task 1: Формат 2 в схеме разделов

**Files:**
- Modify: `packages/ai/src/sections.ts`
- Modify: `packages/ai/src/fallback.ts:4,45`
- Test: `packages/ai/src/sections.test.ts`

**Interfaces:**
- Consumes: ничего нового.
- Produces (из `@grani/ai`): `ChapterTextSections` (формат 1), `ChapterCardsSections` (формат 2), `ChapterSections = ChapterTextSections | ChapterCardsSections`, `SituationSchema`, `cardsShape`, `ChapterCardsSchema`, `parseChapterCards(value: unknown): ChapterCardsSections | null`. `parseSections("chapter_*", value)` принимает оба формата.

- [ ] **Step 1: Write the failing test**

Добавить в `packages/ai/src/sections.test.ts` внутрь `describe("parseSections", …)` перед закрывающей скобкой:

```ts
  test("accepts a cards chapter and still accepts the text chapter", () => {
    const text = { text: long(500), tips: [long(30), long(30), long(30)] };

    expect(parseSections("chapter_money", cards())).toEqual(cards());
    expect(parseSections("chapter_money", text)).toEqual(text);
  });

  test("rejects cards with wrong counts, unknown traits, extra keys and a wrong version", () => {
    expect(parseSections("chapter_money", cards({ situations: cards().situations.slice(0, 4) }))).toBeNull();
    expect(parseSections("chapter_money", cards({ traps: cards().traps.slice(0, 2) }))).toBeNull();
    expect(parseSections("chapter_money", cards({ version: 3 }))).toBeNull();
    expect(parseSections("chapter_money", cards({ extra: "x" }))).toBeNull();
    const badTrait = cards();
    badTrait.situations[0] = { ...badTrait.situations[0]!, traits: ["luck"] };
    expect(parseSections("chapter_money", badTrait)).toBeNull();
  });

  test("a text chapter cannot carry the version marker", () => {
    expect(parseSections("chapter_money", { version: 2, text: long(500), tips: [long(30), long(30), long(30)] })).toBeNull();
  });
```

и в начало файла после `const long = …`:

```ts
const situation = (seed: string) => ({ seed, title: long(30), scene: long(100), why: long(100), traits: ["agreeableness"], say: [long(20)], do: long(60) });
const cards = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  headline: long(60),
  summary: long(200),
  situations: ["a", "b", "c", "d", "e", "f"].map(situation),
  others_see: long(150),
  traps: [1, 2, 3].map(() => ({ trap: long(30), instead: long(30) })),
  ...overrides,
});
```

и добавить импорт `parseChapterCards` в первую строку: `import { parseChapterCards, parseSections, sectionStrings } from "./sections";`, а в конец файла:

```ts
test("parseChapterCards returns the typed value or null", () => {
  expect(parseChapterCards(cards())?.situations).toHaveLength(6);
  expect(parseChapterCards({ text: long(500), tips: [long(30), long(30), long(30)] })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/ai/src/sections.test.ts`
Expected: FAIL (`parseChapterCards` is not exported / cards chapter rejected).

- [ ] **Step 3: Write minimal implementation**

В `packages/ai/src/sections.ts` заменить строки с `ChapterSchema` и типами. Было:

```ts
const ChapterSchema = z.strictObject({ text: text(300, 8000), tips: list(text(20, 1500), 3, 5) });
```

Стало:

```ts
const ChapterSchema = z.strictObject({ text: text(300, 8000), tips: list(text(20, 1500), 3, 5) });

export const SituationSchema = z.strictObject({
  seed: text(2, 40),
  title: text(20, 90),
  scene: text(80, 320),
  why: text(80, 320),
  traits: z.array(z.enum(TRAITS)).min(1).max(2),
  say: list(text(10, 160), 1, 3),
  do: text(40, 260),
});
export const cardsShape = {
  headline: text(40, 140),
  summary: text(150, 500),
  situations: z.array(SituationSchema).min(5).max(6),
  others_see: text(120, 400),
  traps: z.array(z.strictObject({ trap: text(20, 200), instead: text(20, 200) })).length(3),
};
export const ChapterCardsSchema = z.strictObject({ version: z.literal(2), ...cardsShape });
// Формат 1 строгий и не знает поля version, формат 2 требует его — союз однозначен
const ChapterAnySchema = z.union([ChapterSchema, ChapterCardsSchema]);
```

В импорты добавить `TRAITS`: `import { TRAITS, type ChapterKind } from "@grani/core";` (вместо `import type { ChapterKind, ReportKind } from "@grani/core";` — оставить и `ReportKind`: `import { TRAITS, type ChapterKind, type ReportKind } from "@grani/core";`).

Заменить типы:

```ts
export type ChapterTextSections = z.infer<typeof ChapterSchema>;
export type ChapterCardsSections = z.infer<typeof ChapterCardsSchema>;
export type ChapterSections = ChapterTextSections | ChapterCardsSections;
```

В `SECTION_SCHEMAS` четыре главы заменить `ChapterSchema` на `ChapterAnySchema`:

```ts
  chapter_money: ChapterAnySchema,
  chapter_conflict: ChapterAnySchema,
  chapter_stress: ChapterAnySchema,
  chapter_relationships: ChapterAnySchema,
```

После `parseSections` добавить:

```ts
export function parseChapterCards(value: unknown): ChapterCardsSections | null {
  const parsed = ChapterCardsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

В `packages/ai/src/fallback.ts` строка 4: заменить `ChapterSections` на `ChapterTextSections` в импорте и в сигнатуре `function chapter(...): ChapterTextSections`.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run packages/ai` и `pnpm --filter @grani/ai typecheck`
Expected: PASS; typecheck без ошибок в `packages/ai`. (Ошибки в `apps/web` из-за союза типов ожидаемы до Task 7 — не чинить здесь.)

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/sections.ts packages/ai/src/fallback.ts packages/ai/src/sections.test.ts
git commit -m "feat(ai): add the cards format for chapters to the section schemas"
```

---

### Task 2: Темы главы «Деньги»

**Files:**
- Create: `packages/content/src/chapter-seeds.ts`
- Modify: `packages/content/src/index.ts`
- Test: `packages/content/src/chapter-seeds.test.ts`

**Interfaces:**
- Consumes: `ChapterKind`, `Trait`, `TRAITS` из `@grani/core`; `findStopWords` из `./safety`.
- Produces (из `@grani/content`): `ChapterSeed = { id: string; title: string; focus: string; traits: readonly Trait[] }`, `chapterSeeds(kind: ChapterKind): readonly ChapterSeed[]`, `hasCardsFormat(kind: ChapterKind): boolean`.

- [ ] **Step 1: Write the failing test**

`packages/content/src/chapter-seeds.test.ts`:

```ts
import { CHAPTER_KINDS, TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterSeeds, hasCardsFormat } from "./chapter-seeds";
import { findStopWords } from "./safety";

describe("chapterSeeds", () => {
  test("the money chapter has six distinct themes with valid traits", () => {
    const seeds = chapterSeeds("chapter_money");

    expect(seeds).toHaveLength(6);
    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(6);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(6);
    for (const seed of seeds) {
      expect(seed.title.length).toBeGreaterThanOrEqual(8);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.traits.length).toBeGreaterThan(0);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
    }
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of chapterSeeds("chapter_money")) expect(findStopWords(`${seed.title} ${seed.focus}`)).toEqual([]);
  });

  test("only the money chapter uses the cards format in the pilot", () => {
    expect(hasCardsFormat("chapter_money")).toBe(true);
    for (const kind of CHAPTER_KINDS.filter((kind) => kind !== "chapter_money")) {
      expect(hasCardsFormat(kind)).toBe(false);
      expect(chapterSeeds(kind)).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/content/src/chapter-seeds.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`packages/content/src/chapter-seeds.ts`:

```ts
import type { ChapterKind, Trait } from "@grani/core";

export type ChapterSeed = { readonly id: string; readonly title: string; readonly focus: string; readonly traits: readonly Trait[] };

// Темы задаёт редакция: так карточки не повторяются и структура одинакова у всех покупателей.
// В пилоте формат карточек только у «Денег»; у остальных глав список пуст
const SEEDS: Readonly<Partial<Record<ChapterKind, readonly ChapterSeed[]>>> = {
  chapter_money: [
    { id: "help", title: "Помощь другим и отказ", focus: "Как человек решает, давать ли деньги в долг, дарить и скидываться, и как ему даётся отказ.", traits: ["agreeableness", "stability"] },
    { id: "surprise", title: "Неожиданные траты", focus: "Что происходит с настроением и решениями, когда появляется непредвиденный расход.", traits: ["stability", "conscientiousness"] },
    { id: "mood", title: "Покупки для настроения", focus: "Покупка как способ сменить состояние: когда это помогает, а когда остаётся только сумма в чеке.", traits: ["stability", "extraversion"] },
    { id: "new", title: "Новые возможности и предложения", focus: "Отношение к незнакомым способам заработать, вложить, попробовать: где осторожность защищает, а где мешает.", traits: ["openness", "conscientiousness"] },
    { id: "periods", title: "Учёт и спонтанные периоды", focus: "Как чередуются аккуратный учёт и спонтанные траты и какая простая система выдержит оба периода.", traits: ["conscientiousness", "extraversion"] },
    { id: "shared", title: "Общие деньги и разговор о них", focus: "Как говорить о деньгах с близкими: договорённости, общие траты, неудобные темы.", traits: ["agreeableness", "extraversion"] },
  ],
};

export function chapterSeeds(kind: ChapterKind): readonly ChapterSeed[] {
  return SEEDS[kind] ?? [];
}

export function hasCardsFormat(kind: ChapterKind): boolean {
  return chapterSeeds(kind).length > 0;
}
```

В `packages/content/src/index.ts` добавить строку `export * from "./chapter-seeds";` после `export * from "./labels";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/content/src/chapter-seeds.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/content/src/chapter-seeds.ts packages/content/src/chapter-seeds.test.ts packages/content/src/index.ts
git commit -m "feat(content): editorial themes for the money chapter cards"
```

---

### Task 3: Запросы, проверки и сборка частей главы

**Files:**
- Create: `packages/ai/src/chapter-style.ts`
- Create: `packages/ai/src/chapter-cards.ts`
- Create: `packages/ai/src/testing.ts`
- Modify: `packages/ai/src/prompt.ts` (экспорт `COMMON_RULES`)
- Modify: `packages/ai/src/index.ts`, `packages/ai/package.json`
- Test: `packages/ai/src/chapter-style.test.ts`, `packages/ai/src/chapter-cards.test.ts`

**Interfaces:**
- Consumes: из Task 1 `cardsShape`, `SituationSchema`, `ChapterCardsSchema`, `parseChapterCards`, `ChapterCardsSections`; из Task 2 `chapterSeeds`, `ChapterSeed`; существующие `extractJson` (`validate.ts`), `sectionStrings` (`sections.ts`), `findStopWords`, `traitBlock`, `CHAPTER_TITLES`, `CHAPTER_SECTIONS` (`@grani/content`), `personalFacts`, `PersonalScores` (`input.ts`), `Prompt` (`prompt.ts`).
- Produces:
  - `chapter-style.ts`: `hedgeCount(text: string): number`, `styleProblems(strings: readonly string[], maxHedges: number): StyleProblem[]`, `type StyleProblem = "hedges" | "empty_phrase" | "past_claim"`.
  - `chapter-cards.ts`: `ChapterPart = "overview" | "situations_a" | "situations_b"`, `CHAPTER_PARTS`, `ChapterCardsContext = { library: Library; kind: ChapterKind; result: PersonalScores }`, `partSeeds(kind, part): readonly ChapterSeed[]`, `buildChapterPartPrompt(part, ctx): Prompt`, `OverviewPart`, `SituationsPart`, `PartFailure`, `validateOverview(raw: string): PartCheck<OverviewPart>`, `validateSituations(raw: string, expectedSeeds: readonly string[]): PartCheck<SituationsPart>`, `assembleChapterCards(overview, a, b): ChapterCardsSections | null`, где `PartCheck<T> = { ok: true; value: T } | { ok: false; reason: PartFailure }`.
  - `testing.ts` (экспорт `@grani/ai/testing`): `SAMPLE_SCORES`, `sampleOverview()`, `sampleSituation(seed: { id: string; title: string })`.

- [ ] **Step 1: Write the failing tests**

`packages/ai/src/chapter-style.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { hedgeCount, styleProblems } from "./chapter-style";

describe("hedgeCount", () => {
  test("counts hedges in any case and ignores words that only contain them", () => {
    expect(hedgeCount("Это может помочь. Возможно, стоит попробовать, и можно сравнить варианты.")).toBe(3);
    expect(hedgeCount("Приложение поможет сложить цифры.")).toBe(0);
  });
});

describe("styleProblems", () => {
  test("accepts direct text with one hedge", () => {
    expect(styleProblems(["Скажи прямо: «Сегодня не могу».", "Это может занять неделю."], 1)).toEqual([]);
  });

  test("flags a second hedge, empty phrases and claims about the past", () => {
    expect(styleProblems(["Может помочь. Возможно, получится."], 1)).toEqual(["hedges"]);
    expect(styleProblems(["Полезный подход — тот, который помогает в твоей конкретной ситуации."], 1)).toEqual(["empty_phrase"]);
    expect(styleProblems(["Ты уже много раз отдавал деньги."], 1)).toEqual(["past_claim"]);
    expect(styleProblems(["Ты всегда откладываешь."], 1)).toEqual(["past_claim"]);
  });

  test("reports each kind of problem once", () => {
    expect(styleProblems(["Ты уже могла. Может. Возможно. В твоей конкретной ситуации."], 1).sort()).toEqual(["empty_phrase", "hedges", "past_claim"]);
  });
});
```

`packages/ai/src/chapter-cards.test.ts`:

```ts
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { assembleChapterCards, buildChapterPartPrompt, partSeeds, validateOverview, validateSituations, type ChapterCardsContext } from "./chapter-cards";
import { SAMPLE_SCORES, sampleOverview, sampleSituation } from "./testing";

const CTX: ChapterCardsContext = { library: getLibrary(), kind: "chapter_money", result: SAMPLE_SCORES };
const SEEDS_A = partSeeds("chapter_money", "situations_a");
const SEEDS_B = partSeeds("chapter_money", "situations_b");
const situations = (seeds: readonly { id: string; title: string }[]) => JSON.stringify({ situations: seeds.map(sampleSituation) });

describe("partSeeds", () => {
  test("splits the six themes into two groups of three and gives the overview none", () => {
    expect(partSeeds("chapter_money", "overview")).toEqual([]);
    expect(SEEDS_A.map((seed) => seed.id)).toEqual(["help", "surprise", "mood"]);
    expect(SEEDS_B.map((seed) => seed.id)).toEqual(["new", "periods", "shared"]);
  });
});

describe("buildChapterPartPrompt", () => {
  test("the situations prompt carries the themes, the five trait blocks and the writing rules", () => {
    const prompt = buildChapterPartPrompt("situations_a", CTX);
    const user = JSON.parse(prompt.user) as { seeds: { id: string }[]; blocks: Record<string, string>; chapter: string };

    expect(user.chapter).toBe("Деньги");
    expect(user.seeds.map((seed) => seed.id)).toEqual(["help", "surprise", "mood"]);
    expect(Object.keys(user.blocks)).toHaveLength(5);
    expect(prompt.system).toContain("на «ты»");
    expect(prompt.system).toContain("«ты уже…»");
    expect(prompt.system).toContain('"situations"');
  });

  test("the overview prompt asks for the headline, the summary, close people and three traps", () => {
    const prompt = buildChapterPartPrompt("overview", CTX);

    expect(JSON.parse(prompt.user).seeds).toEqual([]);
    for (const key of ['"headline"', '"summary"', '"others_see"', '"traps"']) expect(prompt.system).toContain(key);
  });
});

describe("validateOverview", () => {
  test("accepts a good answer, also wrapped in an explanation and a Markdown fence", () => {
    const json = JSON.stringify(sampleOverview());

    expect(validateOverview(json).ok).toBe(true);
    expect(validateOverview("Вот ответ:\n```json\n" + json + "\n```\nГотово.").ok).toBe(true);
  });

  test("rejects broken JSON, a wrong schema, stop words and filler phrases", () => {
    expect(validateOverview("не json")).toEqual({ ok: false, reason: "not_json" });
    expect(validateOverview("{}")).toEqual({ ok: false, reason: "schema" });
    expect(validateOverview(JSON.stringify({ ...sampleOverview(), summary: sampleOverview().summary + " Это похоже на депрессию." }))).toEqual({ ok: false, reason: "stop_words" });
    expect(validateOverview(JSON.stringify({ ...sampleOverview(), others_see: sampleOverview().others_see + " Полезно в твоей конкретной ситуации." }))).toEqual({ ok: false, reason: "style" });
  });
});

describe("validateSituations", () => {
  const ids = SEEDS_A.map((seed) => seed.id);

  test("accepts the expected themes in order", () => {
    expect(validateSituations(situations(SEEDS_A), ids).ok).toBe(true);
  });

  test("rejects missing, reordered, duplicated or foreign themes", () => {
    expect(validateSituations(situations(SEEDS_A.slice(0, 2)), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations([...SEEDS_A].reverse()), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations([SEEDS_A[0]!, SEEDS_A[0]!, SEEDS_A[2]!]), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations(SEEDS_B), ids)).toEqual({ ok: false, reason: "seeds" });
  });

  test("rejects a card with two hedges and a card that speaks about the reader's past", () => {
    const hedged = { ...sampleSituation(SEEDS_A[0]!), scene: "Может быть, друг просит денег. Возможно, ты сразу согласишься, потому что неловко отказывать близкому человеку." };
    const past = { ...sampleSituation(SEEDS_A[0]!), scene: "Ты уже не раз отдавал деньги, хотя планировал другое, и потом долго переживал из-за этого решения." };
    const rest = SEEDS_A.slice(1).map(sampleSituation);

    expect(validateSituations(JSON.stringify({ situations: [hedged, ...rest] }), ids)).toEqual({ ok: false, reason: "style" });
    expect(validateSituations(JSON.stringify({ situations: [past, ...rest] }), ids)).toEqual({ ok: false, reason: "style" });
  });
});

describe("assembleChapterCards", () => {
  const overview = sampleOverview();
  const part = (seeds: readonly { id: string; title: string }[]) => ({ situations: seeds.map(sampleSituation) });

  test("builds one valid cards chapter from the three parts", () => {
    const sections = assembleChapterCards(overview, part(SEEDS_A), part(SEEDS_B));

    expect(sections?.version).toBe(2);
    expect(sections?.situations.map((situation) => situation.seed)).toEqual(["help", "surprise", "mood", "new", "periods", "shared"]);
  });

  test("refuses a chapter in which two cards share a title", () => {
    const twin = { ...sampleSituation(SEEDS_B[0]!), title: sampleSituation(SEEDS_A[0]!).title };

    expect(assembleChapterCards(overview, part(SEEDS_A), { situations: [twin, ...part(SEEDS_B).situations.slice(1)] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/ai/src/chapter-style.test.ts packages/ai/src/chapter-cards.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the implementation**

`packages/ai/src/chapter-style.ts`:

```ts
// Кириллица не входит в \w и \b, поэтому границы слов — через lookaround
const HEDGES = /(?<![а-яё])(?:может|могут|возможно|вероятно|можно сравнить)(?![а-яё])/giu;
const EMPTY_PHRASES: readonly RegExp[] = [/в (?:моей|твоей|вашей) конкретной ситуации/iu, /знакомыми способами и общей целью/iu, /помогает в моей конкретной/iu];
// Ситуации в главе — примеры, а не факты: о прошлом читателя модель знать не может
const PAST_CLAIMS = /(?<![а-яё])(?:ты уже|у тебя было|у тебя уже|ты всегда|ты никогда)(?![а-яё])/iu;

export type StyleProblem = "hedges" | "empty_phrase" | "past_claim";

export function hedgeCount(text: string): number {
  return (text.match(HEDGES) ?? []).length;
}

export function styleProblems(strings: readonly string[], maxHedges: number): StyleProblem[] {
  const problems: StyleProblem[] = [];
  if (strings.reduce((sum, text) => sum + hedgeCount(text), 0) > maxHedges) problems.push("hedges");
  if (strings.some((text) => EMPTY_PHRASES.some((pattern) => pattern.test(text)))) problems.push("empty_phrase");
  if (strings.some((text) => PAST_CLAIMS.test(text))) problems.push("past_claim");
  return problems;
}
```

В `packages/ai/src/prompt.ts` заменить `const COMMON_RULES` на `export const COMMON_RULES` (больше ничего не менять).

`packages/ai/src/chapter-cards.ts`:

```ts
import { chapterSeeds, CHAPTER_SECTIONS, CHAPTER_TITLES, findStopWords, traitBlock, type ChapterSeed, type Library } from "@grani/content";
import { TRAITS, traitLevel, type ChapterKind } from "@grani/core";
import { z } from "zod";
import { styleProblems } from "./chapter-style";
import { personalFacts, type PersonalScores } from "./input";
import { COMMON_RULES, type Prompt } from "./prompt";
import { cardsShape, parseChapterCards, sectionStrings, SituationSchema, type ChapterCardsSections } from "./sections";
import { extractJson } from "./validate";

export type ChapterPart = "overview" | "situations_a" | "situations_b";
export const CHAPTER_PARTS: readonly ChapterPart[] = ["overview", "situations_a", "situations_b"];
export type ChapterCardsContext = { library: Library; kind: ChapterKind; result: PersonalScores };

const SITUATIONS_PER_PART = 3;
const MAX_HEDGES_PER_CARD = 1;
const MAX_HEDGES_OVERVIEW = 2;

export function partSeeds(kind: ChapterKind, part: ChapterPart): readonly ChapterSeed[] {
  const seeds = chapterSeeds(kind);
  if (part === "overview") return [];
  return part === "situations_a" ? seeds.slice(0, SITUATIONS_PER_PART) : seeds.slice(SITUATIONS_PER_PART);
}

const RULES = [
  ...COMMON_RULES,
  "Пиши по-русски, на «ты», обращаясь к одному человеку.",
  "Ситуации — это примеры («например, друг просит денег»), а не факты о читателе: нельзя писать «ты уже…», «у тебя было…», «ты всегда…», «ты никогда…».",
  "«Что сказать» — готовые фразы, которые человек может произнести сразу, без оговорок.",
  "Не более одной оговорки («может», «возможно», «можно сравнить») на карточку: пиши прямо, как опытный редактор.",
  "Не пересказывай блоки слово в слово: объясняй, почему так получается, и предлагай одно конкретное действие.",
];

const OVERVIEW_SHAPE = [
  '{"headline": "главный вывод о человеке в этой сфере, 40–140 знаков",',
  ' "summary": "2–3 предложения о том, как человек обращается с этой сферой, 150–500 знаков",',
  ' "others_see": "как это видят близкие, 120–400 знаков",',
  ' "traps": [{"trap": "типичная ловушка, 20–200 знаков", "instead": "что делать вместо, 20–200 знаков"}, {"trap": "…", "instead": "…"}, {"trap": "…", "instead": "…"}]}',
  "Количество ловушек соблюдай строго: traps — ровно 3 объекта.",
].join("\n");

const SITUATIONS_SHAPE = [
  '{"situations": [{"seed": "id темы из seeds", "title": "название ситуации, 20–90 знаков",',
  ' "scene": "пример ситуации, в которой читатель узнает себя, 80–320 знаков",',
  ' "why": "почему так: свяжи одну-две черты читателя, 80–320 знаков",',
  ' "traits": ["openness"], "say": ["1–3 готовые фразы, по 10–160 знаков"],',
  ' "do": "одно конкретное действие, 40–260 знаков"}]}',
  "Дай по одному объекту на каждую тему из seeds, в том же порядке; seed — её id.",
  `traits — только из: ${TRAITS.join(", ")}.`,
].join("\n");

export function buildChapterPartPrompt(part: ChapterPart, ctx: ChapterCardsContext): Prompt {
  const section = CHAPTER_SECTIONS[ctx.kind];
  const blocks = Object.fromEntries(TRAITS.map((trait) => [trait, traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), section)]));
  const seeds = partSeeds(ctx.kind, part).map(({ id, title, focus, traits }) => ({ id, title, focus, traits }));
  return {
    system: [...RULES, `Схема ответа:\n${part === "overview" ? OVERVIEW_SHAPE : SITUATIONS_SHAPE}`].join("\n\n"),
    // Во входе только баллы, уровни, темы и блоки — имён и идентификаторов в нём нет
    user: JSON.stringify({ chapter: CHAPTER_TITLES[ctx.kind], facts: personalFacts(ctx.result), seeds, blocks }),
  };
}

const OverviewSchema = z.strictObject({ headline: cardsShape.headline, summary: cardsShape.summary, others_see: cardsShape.others_see, traps: cardsShape.traps });
const SituationsSchema = z.strictObject({ situations: z.array(SituationSchema).min(1).max(SITUATIONS_PER_PART) });
export type OverviewPart = z.infer<typeof OverviewSchema>;
export type SituationsPart = z.infer<typeof SituationsSchema>;
export type PartFailure = "not_json" | "schema" | "stop_words" | "style" | "seeds";
export type PartCheck<T> = { ok: true; value: T } | { ok: false; reason: PartFailure };

const hasStopWords = (value: unknown) => sectionStrings(value).some((text) => findStopWords(text).length > 0);

export function validateOverview(raw: string): PartCheck<OverviewPart> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = OverviewSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  if (styleProblems(sectionStrings(parsed.data), MAX_HEDGES_OVERVIEW).length > 0) return { ok: false, reason: "style" };
  return { ok: true, value: parsed.data };
}

export function validateSituations(raw: string, expectedSeeds: readonly string[]): PartCheck<SituationsPart> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = SituationsSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  if (parsed.data.situations.some((card) => styleProblems(sectionStrings(card), MAX_HEDGES_PER_CARD).length > 0)) return { ok: false, reason: "style" };
  const seeds = parsed.data.situations.map((card) => card.seed);
  if (seeds.length !== expectedSeeds.length || seeds.some((seed, index) => seed !== expectedSeeds[index])) return { ok: false, reason: "seeds" };
  return { ok: true, value: parsed.data };
}

export function assembleChapterCards(overview: OverviewPart, a: SituationsPart, b: SituationsPart): ChapterCardsSections | null {
  const situations = [...a.situations, ...b.situations];
  // Одинаковые названия значат, что модель повторила карточку, — такую главу не сохраняем
  if (new Set(situations.map((card) => card.title)).size !== situations.length) return null;
  return parseChapterCards({ version: 2, ...overview, situations });
}
```

`packages/ai/src/testing.ts`:

```ts
import type { PersonalScores } from "./input";

export const SAMPLE_SCORES: PersonalScores = {
  scores: { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 },
  typeCode: "--++",
  stability: "sensitive",
};

export function sampleOverview() {
  return {
    headline: "Ты щедрее к людям, чем к себе, и сильнее всего тревожишься из-за неожиданных трат",
    summary:
      "Деньги для тебя — способ заботиться о людях и держать опору под ногами. Осторожность с новым защищает от лишнего риска, а чувствительность к неожиданным тратам делает запас особенно важным. Ниже — шесть ситуаций с готовыми фразами и действиями.",
    others_see:
      "Близкие видят в тебе человека, на которого можно положиться, когда нужна помощь. При этом со стороны не всегда заметно, как сильно ты переживаешь из-за отданной суммы, поэтому полезно говорить об этом вслух.",
    traps: [
      { trap: "Соглашаться на просьбу сразу, а переживать потом", instead: "Попросить день на ответ и назвать сумму, которую готов отдать" },
      { trap: "Откладывать запас до «лучших времён»", instead: "Начать с суммы на одну неделю обычных расходов" },
      { trap: "Закрывать вопрос покупкой, чтобы стало спокойнее", instead: "Отложить покупку на сутки и проверить, чего на самом деле хочется" },
    ],
  };
}

export function sampleSituation(seed: { id: string; title: string }) {
  return {
    seed: seed.id,
    title: `Ситуация: ${seed.title}`,
    scene: `Например, возникает ситуация из темы «${seed.title}»: нужно быстро решить, как поступить, и вместе с решением приходит напряжение.`,
    why: "Здесь сходятся твои черты: осторожность и чуткость к людям подсказывают держаться знакомого, поэтому важно заранее знать свой ответ.",
    traits: ["agreeableness"],
    say: ["Мне нужно время подумать, отвечу завтра."],
    do: "Запиши заранее сумму и условия, на которых тебе комфортно, и держись их.",
  };
}
```

В `packages/ai/src/index.ts` добавить строки `export * from "./chapter-style";` и `export * from "./chapter-cards";`.

В `packages/ai/package.json` в `exports` добавить `"./testing": "./src/testing.ts"` (по образцу `packages/db/package.json`).

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run packages/ai` и `pnpm --filter @grani/ai typecheck`
Expected: PASS всех тестов `packages/ai`; typecheck без ошибок. Если тест про «две оговорки» не проходит, проверь, что в `scene` действительно два слова из списка (`Может`, `Возможно`).

- [ ] **Step 5: Commit**

```bash
git add packages/ai
git commit -m "feat(ai): prompts, validators and assembly for the chapter cards parts"
```

---

### Task 4: Параллельная генерация главы

**Files:**
- Modify: `packages/ai/src/generate.ts` (экспорт `TimeoutError`, `completeWithTimeout`)
- Create: `packages/ai/src/generate-chapter.ts`
- Modify: `packages/ai/src/testing.ts` (заглушка модели), `packages/ai/src/index.ts`
- Test: `packages/ai/src/generate-chapter.test.ts`

**Interfaces:**
- Consumes: из Task 3 `CHAPTER_PARTS`, `ChapterCardsContext`, `partSeeds`, `buildChapterPartPrompt`, `validateOverview`, `validateSituations`, `assembleChapterCards`, `ChapterPart`, `PartCheck`; из `generate.ts` `ReportWriter`, `GenerateLog`, `GENERATION_ATTEMPTS`, `GENERATION_TIMEOUT_MS`.
- Produces: `generateChapterCards(writer: ReportWriter, ctx: ChapterCardsContext, options?: { timeoutMs?: number; attempts?: number; log?: GenerateLog }): Promise<{ sections: ChapterCardsSections; attempts: number } | null>`; в `testing.ts`: `cardsStubWriter(script?: Partial<Record<ChapterPart, readonly string[]>>): ReportWriter & { calls: Prompt[] }` — отвечает по части, определяя её по числу тем во входе (0 — обзор; иначе первая тема: `help` — группа A, `new` — группа B), `script` задаёт цепочку ответов для части (элемент `"hang"` — зависание), по умолчанию всегда корректный ответ.

- [ ] **Step 1: Write the failing test**

`packages/ai/src/generate-chapter.test.ts`:

```ts
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { generateChapterCards } from "./generate-chapter";
import type { ChapterCardsContext } from "./chapter-cards";
import { chapterSeeds } from "@grani/content";
import { cardsStubWriter, SAMPLE_SCORES, sampleSituation } from "./testing";

const CTX: ChapterCardsContext = { library: getLibrary(), kind: "chapter_money", result: SAMPLE_SCORES };

describe("generateChapterCards", () => {
  test("makes three requests and assembles one chapter", async () => {
    const stub = cardsStubWriter();

    const result = await generateChapterCards(stub, CTX);

    expect(stub.calls).toHaveLength(3);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.situations).toHaveLength(6);
    expect(result?.sections.version).toBe(2);
  });

  test("retries a part that came back broken without repeating the other parts", async () => {
    const log = vi.fn();
    const stub = cardsStubWriter({ overview: ["не json"] });

    const result = await generateChapterCards(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(4);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ part: "overview", attempt: 1, reason: "not_json" }));
  });

  test("returns null when a part keeps failing, so the caller falls back", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}"] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });

  test("a hanging part ends in null instead of a half-finished chapter", async () => {
    const stub = cardsStubWriter({ situations_a: ["hang", "hang", "hang"] });

    expect(await generateChapterCards(stub, CTX, { timeoutMs: 20 })).toBeNull();
  });

  test("a model error counts as an attempt", async () => {
    const stub = cardsStubWriter({ situations_a: [new Error("503")] });

    const result = await generateChapterCards(stub, CTX);

    expect(result?.attempts).toBe(2);
  });

  test("themes in the wrong order are never accepted, so no chapter is saved", async () => {
    const reversed = JSON.stringify({ situations: [...chapterSeeds("chapter_money").slice(0, 3)].reverse().map(sampleSituation) });
    const stub = cardsStubWriter({ situations_a: [reversed, reversed, reversed] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/ai/src/generate-chapter.test.ts`
Expected: FAIL (module `./generate-chapter` not found).

- [ ] **Step 3: Write the implementation**

В `packages/ai/src/generate.ts`: заменить `class TimeoutError extends Error {}` на `export class TimeoutError extends Error {}` и `async function completeWithTimeout(` на `export async function completeWithTimeout(`.

`packages/ai/src/generate-chapter.ts`:

```ts
import {
  assembleChapterCards,
  buildChapterPartPrompt,
  CHAPTER_PARTS,
  partSeeds,
  validateOverview,
  validateSituations,
  type ChapterCardsContext,
  type ChapterPart,
  type PartCheck,
} from "./chapter-cards";
import { completeWithTimeout, GENERATION_ATTEMPTS, GENERATION_TIMEOUT_MS, TimeoutError, type GenerateLog, type ReportWriter } from "./generate";
import type { ChapterCardsSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };
type PartResult<T> = { value: T; attempts: number };

async function runPart<T>(writer: ReportWriter, part: ChapterPart, ctx: ChapterCardsContext, check: (raw: string) => PartCheck<T>, options: Options): Promise<PartResult<T> | null> {
  const prompt = buildChapterPartPrompt(part, ctx);
  const attempts = options.attempts ?? GENERATION_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let reason: string;
    try {
      const checked = check(await completeWithTimeout(writer, prompt, options.timeoutMs ?? GENERATION_TIMEOUT_MS));
      if (checked.ok) return { value: checked.value, attempts: attempt };
      reason = checked.reason;
    } catch (error) {
      reason = error instanceof TimeoutError ? "timeout" : `error: ${String(error)}`;
    }
    // Текст ответа в лог не пишется: в нём может оказаться то, что проверка как раз не пропустила
    options.log?.("chapter part rejected", { kind: ctx.kind, writer: writer.name, part, attempt, reason });
  }
  return null;
}

// Три части идут параллельно: так глава укладывается во время одной задачи, а сбой одной части не портит остальные.
// Если какая-то часть не получилась за все попытки, возвращается null — вызывающий соберёт главу из блоков
export async function generateChapterCards(writer: ReportWriter, ctx: ChapterCardsContext, options: Options = {}): Promise<{ sections: ChapterCardsSections; attempts: number } | null> {
  const [overviewPart, partA, partB] = CHAPTER_PARTS;
  const idsOf = (part: ChapterPart) => partSeeds(ctx.kind, part).map((seed) => seed.id);
  const [overview, a, b] = await Promise.all([
    runPart(writer, overviewPart!, ctx, validateOverview, options),
    runPart(writer, partA!, ctx, (raw) => validateSituations(raw, idsOf(partA!)), options),
    runPart(writer, partB!, ctx, (raw) => validateSituations(raw, idsOf(partB!)), options),
  ]);
  if (!overview || !a || !b) return null;
  const sections = assembleChapterCards(overview.value, a.value, b.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: ctx.kind, writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: Math.max(overview.attempts, a.attempts, b.attempts) };
}
```

В `packages/ai/src/testing.ts` добавить в начало импорты и в конец заглушку:

```ts
import type { ChapterPart } from "./chapter-cards";
import type { ReportWriter } from "./generate";
import type { Prompt } from "./prompt";
```

```ts
type Step = string | Error | "hang";

// Определяет часть по первой теме входа: пустой список — обзор, «help» — группа A, иначе группа B
function partOf(prompt: Prompt): ChapterPart {
  const seeds = (JSON.parse(prompt.user) as { seeds: { id: string }[] }).seeds;
  if (seeds.length === 0) return "overview";
  return seeds[0]!.id === "help" ? "situations_a" : "situations_b";
}

export function cardsStubWriter(script: Partial<Record<ChapterPart, readonly Step[]>> = {}): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const queues = new Map<ChapterPart, Step[]>(Object.entries(script).map(([part, steps]) => [part as ChapterPart, [...(steps as Step[])]]));
  return {
    name: "stub",
    calls,
    async complete(prompt) {
      calls.push(prompt);
      const part = partOf(prompt);
      const step = queues.get(part)?.shift();
      if (step === "hang") return new Promise<string>(() => {});
      if (step instanceof Error) throw step;
      if (typeof step === "string") return step;
      const seeds = (JSON.parse(prompt.user) as { seeds: { id: string; title: string }[] }).seeds;
      return JSON.stringify(part === "overview" ? sampleOverview() : { situations: seeds.map(sampleSituation) });
    },
  };
}
```

В `packages/ai/src/index.ts` добавить `export * from "./generate-chapter";`.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run packages/ai` и `pnpm --filter @grani/ai typecheck`
Expected: PASS. Если «hang»-тест завис, убедись, что `timeoutMs: 20` передан в `generateChapterCards`.

- [ ] **Step 5: Commit**

```bash
git add packages/ai
git commit -m "feat(ai): generate the money chapter as cards in three parallel requests"
```

---

### Task 5: Воркер: флаг и выбор формата

**Files:**
- Modify: `apps/worker/src/env.ts`, `apps/worker/src/generate.ts`, `apps/worker/src/main.ts`
- Modify: `apps/worker/src/env.test.ts`, `apps/worker/src/generate.test.ts`
- Modify: `deploy/env.example`, `deploy/server-setup.md`

**Interfaces:**
- Consumes: `generateChapterCards`, `generateReport`, `GeneratedReport`, `fallbackSections` из `@grani/ai`; `hasCardsFormat` из `@grani/content`; `cardsStubWriter` из `@grani/ai/testing`.
- Produces: `WorkerEnv.chapterCardsV2: boolean`; `GenerateDeps.chapterCardsV2?: boolean` (по умолчанию выключено).

- [ ] **Step 1: Write the failing tests**

В `apps/worker/src/env.test.ts`: в двух существующих ожиданиях `toEqual({...})` добавить поле `chapterCardsV2: false` (в первом: `{ ...BASE, vkGroupToken: null, dryRun: false, poolMax: 3, ai: { provider: "none" }, chapterCardsV2: false }`; во втором — после `ai: { provider: "none" },` строку `chapterCardsV2: false,`). Добавить тест:

```ts
test("the chapter cards pilot is off unless CHAPTER_CARDS_V2 is 1", () => {
  expect(readWorkerEnv(BASE).chapterCardsV2).toBe(false);
  expect(readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "0" }).chapterCardsV2).toBe(false);
  expect(readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "1" }).chapterCardsV2).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "yes" })).toThrow(/CHAPTER_CARDS_V2/);
});
```

В `apps/worker/src/generate.test.ts` добавить импорт `import { cardsStubWriter } from "@grani/ai/testing";` и `import { parseSections } from "@grani/ai";` (объединить с существующим импортом из `@grani/ai`), и внутрь `describe("runGenerate", …)` тесты:

```ts
  test("with the pilot flag the money chapter is saved as cards written by the model", async () => {
    deps.writer = cardsStubWriter();
    deps.chapterCardsV2 = true;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "chapter_money");
    expect(report?.source).toBe("ai");
    expect(parseSections("chapter_money", report?.sections)).toMatchObject({ version: 2 });
  });

  test("when a part fails the chapter is built from the library and no model answer is mixed in", async () => {
    deps.writer = cardsStubWriter({ overview: ["{}", "{}", "{}"] });
    deps.chapterCardsV2 = true;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "chapter_money");
    expect(report?.source).toBe("fallback");
    expect(parseSections("chapter_money", report?.sections)).toHaveProperty("tips");
  });

  test("without the flag the model is asked once, for the old chapter format", async () => {
    const stub = oldFormatWriter("chapter_money");
    deps.writer = stub;

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    expect(stub.calls).toHaveLength(1);
    expect(JSON.parse(stub.calls[0]!.user)).not.toHaveProperty("seeds");
  });

  test("other chapters stay in the old format even with the flag", async () => {
    const stub = oldFormatWriter("chapter_stress");
    deps.writer = stub;
    deps.chapterCardsV2 = true;

    await runGenerate({ kind: "chapter_stress", resultId: anna.resultId }, deps);

    expect(stub.calls).toHaveLength(1);
    expect(JSON.parse(stub.calls[0]!.user)).not.toHaveProperty("seeds");
  });
```

Хелпер `oldFormatWriter` и константа результата — в начале файла `apps/worker/src/generate.test.ts` (после `let anna …`):

```ts
const CHAPTER_RESULT = { scores: { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 }, typeCode: "++++", stability: "sensitive" } as const;

// Модель, которая отвечает по-старому: одним корректным текстом главы формата 1
function oldFormatWriter(kind: "chapter_money" | "chapter_stress"): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const answer = JSON.stringify(fallbackSections(buildPersonalInput(getLibrary(), kind, CHAPTER_RESULT)));
  return { name: "stub", calls, complete: async (prompt) => (calls.push(prompt), answer) };
}
```

и импорт `import type { Prompt, ReportWriter } from "@grani/ai";` (объединить с существующим импортом из `@grani/ai`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/worker/src/env.test.ts apps/worker/src/generate.test.ts`
Expected: FAIL (`chapterCardsV2` отсутствует).

- [ ] **Step 3: Write the implementation**

`apps/worker/src/env.ts`: в `schema` добавить `CHAPTER_CARDS_V2: z.enum(["0", "1"]).optional(),`; в тип `WorkerEnv` — `chapterCardsV2: boolean`; в возвращаемый объект `readWorkerEnv` — `chapterCardsV2: env.CHAPTER_CARDS_V2 === "1",`.

`apps/worker/src/generate.ts`: в импорт из `@grani/ai` добавить `generateChapterCards, type GeneratedReport`; из `@grani/content` — `hasCardsFormat`; из `@grani/core` — `type ChapterKind`. В `GenerateDeps` добавить поле `chapterCardsV2?: boolean`. Перед `runGenerate` добавить:

```ts
// Формат карточек — только у глав с темами и только при включённом флаге и подключённом ИИ
type ChapterJob = { kind: ChapterKind; resultId: string };

function usesCards(job: GenerateJob, deps: GenerateDeps): job is ChapterJob {
  return deps.chapterCardsV2 === true && deps.writer !== null && isChapter(job.kind) && hasCardsFormat(job.kind as ChapterKind);
}

async function generateCards(job: ChapterJob, deps: GenerateDeps): Promise<GeneratedReport | null> {
  const result = await getResult(deps.db, job.resultId);
  if (!result || !deps.writer) return null;
  const cards = await generateChapterCards(deps.writer, { library: deps.library, kind: job.kind, result }, { log: (message, extra) => deps.log("warn", message, extra) });
  return cards ? { sections: cards.sections, source: "ai", attempts: cards.attempts } : null;
}
```

В `runGenerate` заменить строку `const generated = await generateReport(deps.writer, input, …);` на:

```ts
  const cardsRequested = usesCards(job, deps);
  const cards = cardsRequested ? await generateCards(job, deps) : null;
  // Если карточки не получились, глава собирается из блоков без повторного обращения к модели
  const generated = cards ?? (await generateReport(cardsRequested ? null : deps.writer, input, { log: (message, extra) => deps.log("warn", message, extra) }));
```

`apps/worker/src/main.ts`: в вызове `runGenerate(job.data, { db, library, writer, log, enqueueNotify })` добавить `chapterCardsV2: env.chapterCardsV2`; в строку `log("info", "worker started", {...})` добавить `chapterCardsV2: env.chapterCardsV2`.

`deploy/env.example` после строки `#GIGACHAT_SCOPE=GIGACHAT_API_PERS` добавить:

```
# Пилот: глава «Деньги» карточками. Включать только вместе с ИИ (yandex/gigachat) после проверки
#CHAPTER_CARDS_V2=1
```

`deploy/server-setup.md` в конец раздела `## 10. ИИ` перед следующим разделом добавить:

```
**Пилот «Деньги карточками».** `CHAPTER_CARDS_V2=1` в `.env`, затем `docker compose up -d worker`. В строке `worker started` должно быть `chapterCardsV2: true`. Откат — убрать переменную и перезапустить воркер: уже созданные главы продолжат открываться.
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run apps/worker` и `pnpm --filter @grani/worker typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker deploy
git commit -m "feat(worker): generate the money chapter as cards behind CHAPTER_CARDS_V2"
```

---

### Task 6: Компонент главы-карточек

**Files:**
- Create: `apps/web/src/lib/chapter-view.ts`, `apps/web/src/lib/chapter-axes.ts`
- Create: `apps/web/src/components/ChapterCards.tsx`, `apps/web/src/components/ChapterCards.module.css`
- Test: `apps/web/src/lib/chapter-axes.test.ts`, `apps/web/src/lib/chapter-view.test.ts`, `apps/web/src/components/ChapterCards.test.tsx`

**Interfaces:**
- Consumes: типы `ChapterSections`, `ChapterCardsSections` из `@grani/ai` (только типы — в браузерный бандл ничего не тянется); `TraitScores`, `Trait`, `ChapterKind` из `@grani/core` (типы); `EDITION_TRAITS` из `@/lib/personal-edition-copy`; `SAMPLE`-данные в тесте — `sampleOverview`, `sampleSituation` из `@grani/ai/testing`.
- Produces: `isChapterCards(sections: ChapterSections): sections is ChapterCardsSections`; `chapterAxes(kind, scores): readonly ChapterAxis[]` с `ChapterAxis = { trait: Trait; low: string; high: string; value: number }`; `<ChapterCards kind sections scores practiceHref? />`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/chapter-view.test.ts`:

```ts
import type { ChapterCardsSections, ChapterTextSections } from "@grani/ai";
import { describe, expect, test } from "vitest";
import { isChapterCards } from "./chapter-view";

describe("isChapterCards", () => {
  test("recognises the cards format by its version and leaves the text format alone", () => {
    const text: ChapterTextSections = { text: "а".repeat(400), tips: ["а".repeat(30), "а".repeat(30), "а".repeat(30)] };

    expect(isChapterCards(text)).toBe(false);
    expect(isChapterCards({ version: 2 } as unknown as ChapterCardsSections)).toBe(true);
  });
});
```

`apps/web/src/lib/chapter-axes.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { chapterAxes } from "./chapter-axes";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };

describe("chapterAxes", () => {
  test("the money chapter has three axes taken from the matching scores", () => {
    const axes = chapterAxes("chapter_money", SCORES);

    expect(axes.map((axis) => [axis.trait, axis.value])).toEqual([["openness", 30], ["agreeableness", 60], ["stability", 35]]);
    for (const axis of axes) {
      expect(axis.low.length).toBeGreaterThan(5);
      expect(axis.high.length).toBeGreaterThan(5);
    }
  });

  test("scores are clamped to 0–100 and rounded", () => {
    expect(chapterAxes("chapter_money", { ...SCORES, openness: 130.4, agreeableness: -5, stability: 49.6 }).map((axis) => axis.value)).toEqual([100, 0, 50]);
  });

  test("chapters without axes return an empty list", () => {
    expect(chapterAxes("chapter_stress", SCORES)).toEqual([]);
  });
});
```

`apps/web/src/components/ChapterCards.test.tsx`:

```tsx
import { parseChapterCards, type ChapterCardsSections } from "@grani/ai";
import { sampleOverview, sampleSituation } from "@grani/ai/testing";
import { chapterSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ChapterCards } from "./ChapterCards";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const sections = (patch: (value: ChapterCardsSections) => ChapterCardsSections = (value) => value): ChapterCardsSections => {
  const built = parseChapterCards({ version: 2, ...sampleOverview(), situations: chapterSeeds("chapter_money").map(sampleSituation) });
  if (!built) throw new Error("fixture is not a valid chapter");
  return patch(built);
};

describe("ChapterCards", () => {
  test("shows the headline, six cards with every part, the people block and three traps", () => {
    const html = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(html).toContain("Ты щедрее к людям, чем к себе");
    expect(html.match(/<article/g)).toHaveLength(6);
    for (const label of ["Узнаёшь себя?", "Почему так", "Что сказать", "Что сделать", "Как это видят близкие", "Три ловушки"]) expect(html).toContain(label);
    expect(html).toContain("«Мне нужно время подумать, отвечу завтра.»");
    expect(html.match(/data-trap/g)).toHaveLength(3);
  });

  test("draws the three money axes with the reader's scores", () => {
    const html = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(html.match(/role="img"/g)).toHaveLength(3);
    expect(html).toContain("30 из 100");
    expect(html).toContain("Трудно отказать");
  });

  test("links to the finance compass only when the practice is available", () => {
    const withLink = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} practiceHref="/report/r1/practice/money" />);
    const without = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(withLink).toContain('href="/report/r1/practice/money"');
    expect(without).not.toContain("/practice/money");
  });

  test("model text is escaped, not interpreted as HTML", () => {
    const html = renderToStaticMarkup(
      <ChapterCards kind="chapter_money" sections={sections((value) => ({ ...value, headline: "<script>alert(1)</script> " + value.headline }))} scores={SCORES} />,
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/lib/chapter-view.test.ts apps/web/src/lib/chapter-axes.test.ts apps/web/src/components/ChapterCards.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the implementation**

`apps/web/src/lib/chapter-view.ts`:

```ts
import type { ChapterCardsSections, ChapterSections } from "@grani/ai";

// Только типы из @grani/ai: клиентский код не тянет в бандл ИИ-пакет и библиотеку текстов
export function isChapterCards(sections: ChapterSections): sections is ChapterCardsSections {
  return "version" in sections && sections.version === 2;
}
```

`apps/web/src/lib/chapter-axes.ts`:

```ts
import type { ChapterKind, Trait, TraitScores } from "@grani/core";

export type ChapterAxis = { trait: Trait; low: string; high: string; value: number };

const AXES: Partial<Record<ChapterKind, readonly { trait: Trait; low: string; high: string }[]>> = {
  chapter_money: [
    { trait: "openness", low: "Держусь проверенного", high: "Охотно пробую новое" },
    { trait: "agreeableness", low: "Легко отказываю", high: "Трудно отказать" },
    { trait: "stability", low: "Острая реакция на неожиданное", high: "Спокойно встречаю неожиданное" },
  ],
};

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

export function chapterAxes(kind: ChapterKind, scores: TraitScores): readonly ChapterAxis[] {
  return (AXES[kind] ?? []).map((axis) => ({ ...axis, value: clamp(scores[axis.trait]) }));
}
```

`apps/web/src/components/ChapterCards.tsx`:

```tsx
import type { ChapterCardsSections } from "@grani/ai";
import type { ChapterKind, TraitScores } from "@grani/core";
import { chapterAxes } from "@/lib/chapter-axes";
import { EDITION_TRAITS } from "@/lib/personal-edition-copy";
import styles from "./ChapterCards.module.css";

type Props = { kind: ChapterKind; sections: ChapterCardsSections; scores: TraitScores; practiceHref?: string };

export function ChapterCards({ kind, sections, scores, practiceHref }: Props) {
  const axes = chapterAxes(kind, scores);
  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <p className={styles.label}>Главный вывод</p>
        <h3>{sections.headline}</h3>
        <p>{sections.summary}</p>
      </header>

      {axes.length > 0 && (
        <div className={styles.axes}>
          {axes.map((axis) => (
            <div key={axis.trait} className={styles.axis} role="img" aria-label={`${axis.low} — ${axis.high}: ${axis.value} из 100`}>
              <div className={styles.poles}>
                <span>{axis.low}</span>
                <span>{axis.high}</span>
              </div>
              <div className={styles.track}>
                <i style={{ left: `${axis.value}%` }} />
              </div>
              <p className={styles.score}>{axis.value} из 100</p>
            </div>
          ))}
        </div>
      )}

      <ol className={styles.cards}>
        {sections.situations.map((card, index) => (
          <li key={card.seed}>
            <article className={styles.card}>
              <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
              <h4>{card.title}</h4>
              <h5>Узнаёшь себя?</h5>
              <p>{card.scene}</p>
              <h5>Почему так</h5>
              <p>{card.why}</p>
              <p className={styles.chips}>
                {card.traits.map((trait) => (
                  <span key={trait}>{EDITION_TRAITS[trait].label}</span>
                ))}
              </p>
              <h5>Что сказать</h5>
              <ul className={styles.say}>
                {card.say.map((phrase) => (
                  <li key={phrase}>«{phrase}»</li>
                ))}
              </ul>
              <h5>Что сделать</h5>
              <p>{card.do}</p>
            </article>
          </li>
        ))}
      </ol>

      <section className={styles.block}>
        <h4>Как это видят близкие</h4>
        <p>{sections.others_see}</p>
      </section>

      <section className={styles.block}>
        <h4>Три ловушки</h4>
        <ul className={styles.traps}>
          {sections.traps.map((item) => (
            <li key={item.trap} data-trap>
              <p>{item.trap}</p>
              <p className={styles.instead}>Вместо этого: {item.instead}</p>
            </li>
          ))}
        </ul>
      </section>

      {practiceHref && (
        <a className={styles.practice} href={practiceHref}>
          Продолжить в финансовом компасе ↗
        </a>
      )}
    </div>
  );
}
```

`apps/web/src/components/ChapterCards.module.css`:

```css
.root {
  --cc-surface: #102a21;
  --cc-line: rgba(212, 184, 120, 0.28);
  --cc-text: #f1ecdf;
  --cc-muted: #b9c4b8;
  --cc-accent: #d4b878;
  display: grid;
  gap: 28px;
  margin-top: 28px;
  color: var(--cc-text);
  overflow-wrap: anywhere;
}
.root h3,
.root h4 { font-family: var(--font-display), Georgia, serif; font-weight: 400; margin: 0; }
.root h3 { font-size: clamp(26px, 4vw, 38px); line-height: 1.2; }
.root h4 { font-size: 22px; line-height: 1.3; }
.root h5 { margin: 18px 0 6px; font: 600 12px/1.4 var(--font-body), system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cc-accent); }
.root p { margin: 0 0 10px; line-height: 1.65; }
.label { font: 600 12px/1.4 var(--font-body), system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cc-accent); }
.head { display: grid; gap: 10px; max-width: 720px; }
/* Липкая навигация разбора не должна закрывать заголовки при переходе по ссылке */
.root h3, .root h4, .card, .block { scroll-margin-top: 110px; }

.axes { display: grid; gap: 18px; padding: 20px; border: 1px solid var(--cc-line); border-radius: 6px; background: var(--cc-surface); }
.poles { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; color: var(--cc-muted); }
.track { position: relative; height: 2px; margin: 12px 0 6px; background: var(--cc-line); }
.track i { position: absolute; top: -6px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: var(--cc-accent); }
.score { margin: 0; font-size: 13px; color: var(--cc-muted); }

.cards { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card { height: 100%; padding: 24px; border: 1px solid var(--cc-line); border-radius: 6px; background: var(--cc-surface); }
.number { font: 300 32px/1 var(--font-display), Georgia, serif; color: var(--cc-accent); margin: 0 0 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips span { padding: 2px 10px; border: 1px solid var(--cc-line); border-radius: 999px; font-size: 12px; color: var(--cc-muted); }
.say { margin: 0 0 10px; padding-left: 18px; }
.say li { margin-bottom: 4px; line-height: 1.6; }

.block { padding: 24px; border: 1px solid var(--cc-line); border-radius: 6px; background: var(--cc-surface); }
.traps { display: grid; gap: 14px; margin: 12px 0 0; padding: 0; list-style: none; }
.instead { color: var(--cc-muted); }
.practice { justify-self: start; padding: 12px 20px; border: 1px solid var(--cc-accent); border-radius: 999px; color: var(--cc-text); text-decoration: none; }
.practice:hover { background: rgba(212, 184, 120, 0.12); }

@media (max-width: 760px) {
  .cards { grid-template-columns: 1fr; }
  .card, .block, .axes { padding: 18px; }
  .poles { flex-direction: column; gap: 2px; }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm exec vitest run apps/web/src/lib/chapter-view.test.ts apps/web/src/lib/chapter-axes.test.ts apps/web/src/components/ChapterCards.test.tsx`
Expected: PASS. Затем `pnpm --filter @grani/web typecheck` — на этом шаге возможны ошибки только в местах, читающих `sections.text` (чинятся в Task 7).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/chapter-view.ts apps/web/src/lib/chapter-view.test.ts apps/web/src/lib/chapter-axes.ts apps/web/src/lib/chapter-axes.test.ts apps/web/src/components/ChapterCards.tsx apps/web/src/components/ChapterCards.module.css apps/web/src/components/ChapterCards.test.tsx
git commit -m "feat(web): chapter cards component with money axes"
```

---

### Task 7: Подключение на страницах и превью тем

**Files:**
- Create: `apps/web/src/components/personality-atlas/ChapterReading.tsx`
- Modify: `apps/web/src/components/personality-atlas/PersonalEdition.tsx`
- Modify: `apps/web/src/app/report/[resultId]/page.tsx`
- Modify: `apps/web/src/app/report/[resultId]/practice/money/page.tsx`
- Test: `apps/web/src/components/personality-atlas/ChapterReading.test.tsx`; добавления в `apps/web/src/app/report/[resultId]/page.test.tsx`

**Interfaces:**
- Consumes: из Task 6 `ChapterCards`, `isChapterCards`; `ChapterView` из `@/lib/report-view`; `chapterSeeds` из `@grani/content` (только на сервере, в `page.tsx`); `Paragraphs` из `@/components/Paragraphs`.
- Produces: `<ChapterReading chapter scores question paperClassName preparing practiceHref? themes? />` — тело главы для четырёх состояний (карточки, текст формата 1, «готовится», «ещё не куплена»); `PersonalEdition` принимает необязательное `chapterPreviews?: Readonly<Partial<Record<ChapterKind, readonly string[]>>>`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/components/personality-atlas/ChapterReading.test.tsx`:

```tsx
import { buildPersonalInput, fallbackSections, parseChapterCards, type ChapterTextSections } from "@grani/ai";
import { sampleOverview, sampleSituation } from "@grani/ai/testing";
import { chapterSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ChapterView } from "@/lib/report-view";
import { ChapterReading } from "./ChapterReading";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const THEMES = chapterSeeds("chapter_money").map((seed) => seed.title);
const cards = parseChapterCards({ version: 2, ...sampleOverview(), situations: chapterSeeds("chapter_money").map(sampleSituation) })!;
const text = fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", { scores: SCORES, typeCode: "--++", stability: "sensitive" })) as ChapterTextSections;

function render(chapter: ChapterView, extra: { themes?: readonly string[]; practiceHref?: string } = {}) {
  return renderToStaticMarkup(
    <ChapterReading chapter={chapter} scores={SCORES} question="Что стоит за моими денежными привычками?" paperClassName="paper" preparing={<p>Готовим главу…</p>} {...extra} />,
  );
}

describe("ChapterReading", () => {
  test("a cards chapter is shown as cards with the compass link", () => {
    const html = render({ kind: "chapter_money", title: "Деньги", state: "ready", sections: cards }, { practiceHref: "/report/r/practice/money" });

    expect(html).toContain("Ты щедрее к людям, чем к себе");
    expect(html).toContain('href="/report/r/practice/money"');
    expect(html).not.toContain('class="paper"');
  });

  test("an old text chapter still shows its paragraphs and tips", () => {
    const html = render({ kind: "chapter_money", title: "Деньги", state: "ready", sections: text });

    expect(html).toContain('class="paper"');
    expect(html).toContain("Ориентиры для себя");
    expect(html).toContain(text.tips[0]!.slice(0, 30));
    expect(html).not.toContain("Главный вывод");
  });

  test("a chapter that is being prepared shows the waiting note", () => {
    expect(render({ kind: "chapter_money", title: "Деньги", state: "preparing" })).toContain("Готовим главу…");
  });

  test("an unbought chapter shows the question and the real themes, or no list without themes", () => {
    const available: ChapterView = { kind: "chapter_money", title: "Деньги", state: "available", price: "99 ₽" };
    const withThemes = render(available, { themes: THEMES });

    expect(withThemes).toContain("Что стоит за моими денежными привычками?");
    expect(withThemes).toContain("Что разберём");
    for (const title of THEMES) expect(withThemes).toContain(title);
    expect(render(available)).not.toContain("Что разберём");
  });
});
```

В `apps/web/src/app/report/[resultId]/page.test.tsx` в начало добавить импорты `import { parseChapterCards } from "@grani/ai"; import { sampleOverview, sampleSituation } from "@grani/ai/testing"; import { chapterSeeds } from "@grani/content";` и в конец файла два теста (по образцу существующих; флаг атласа выключен):

```tsx
const moneyView = (sections: unknown) => ({ full, preparing: false, friends: { state: "waiting", counter: "0 из 3" }, bundle: null, chapters: [{ kind: "chapter_money", title: "Деньги", state: "ready", sections }] });

test("flag off: an old text chapter is shown as before", async () => {
  mocks.view.mockReturnValue(moneyView({ text: "Старый абзац главы про деньги, который уже оплатили.", tips: ["Старый совет номер один", "Старый совет номер два", "Старый совет номер три"] }));

  const html = await render();

  expect(html).toContain("Старый абзац главы про деньги");
  expect(html).toContain("Старый совет номер два");
});

test("flag off: a cards chapter is shown as cards", async () => {
  const cards = parseChapterCards({ version: 2, ...sampleOverview(), situations: chapterSeeds("chapter_money").map(sampleSituation) });
  mocks.view.mockReturnValue(moneyView(cards));

  const html = await render();

  expect(html).toContain("Ты щедрее к людям, чем к себе");
  expect(html.match(/<article/g)).toHaveLength(6);
});
```

Если тест не находит `scores` результата, прочитать `beforeEach` в этом файле и добавить поле `scores` в мок `mocks.result`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/components/personality-atlas/ChapterReading.test.tsx "apps/web/src/app/report/[resultId]/page.test.tsx"`
Expected: FAIL (`ChapterReading` не найден; страница не знает формата 2).

- [ ] **Step 3: Write the implementation**

`apps/web/src/components/personality-atlas/ChapterReading.tsx`:

```tsx
import type { TraitScores } from "@grani/core";
import type { ReactNode } from "react";
import { ChapterCards } from "@/components/ChapterCards";
import { Paragraphs } from "@/components/Paragraphs";
import { isChapterCards } from "@/lib/chapter-view";
import type { ChapterView } from "@/lib/report-view";

type Props = {
  chapter: ChapterView;
  scores: TraitScores;
  question: string;
  paperClassName: string;
  preparing: ReactNode;
  practiceHref?: string;
  themes?: readonly string[];
};

// Тело главы по состояниям: карточки, прежний текст формата 1, «готовится», «ещё не куплена»
export function ChapterReading({ chapter, scores, question, paperClassName, preparing, practiceHref, themes }: Props) {
  if (chapter.state === "ready") {
    if (isChapterCards(chapter.sections)) return <ChapterCards kind={chapter.kind} sections={chapter.sections} scores={scores} practiceHref={practiceHref} />;
    return (
      <div className={paperClassName}>
        <Paragraphs text={chapter.sections.text} />
        <h3>Ориентиры для себя</h3>
        <ul>{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </div>
    );
  }
  if (chapter.state === "preparing") return <div className={paperClassName}>{preparing}</div>;
  return (
    <div className={paperClassName}>
      <h3>{question}</h3>
      <p>Персональный текст и рекомендации, связанные с вашим профилем. Глава дополняет основной разбор в выбранной сфере.</p>
      {themes && themes.length > 0 && (
        <>
          <h3>Что разберём</h3>
          <ul>{themes.map((title) => <li key={title}>{title}</li>)}</ul>
        </>
      )}
    </div>
  );
}
```

`apps/web/src/components/personality-atlas/PersonalEdition.tsx` (файл написан длинными строками — перед правкой прочитать точный текст через Read):
- в импорты добавить `import { ChapterReading } from "./ChapterReading";`;
- в `type Props` добавить `;chapterPreviews?:Readonly<Partial<Record<ChapterKind,readonly string[]>>>`, в деструктуризацию параметров `PersonalEdition({…})` добавить `chapterPreviews`;
- заменить блок `<div className={`${styles.paper} ${styles.chapterReading}`}>{selectedChapter.state==="ready"?…:<>…</>}</div>` (от этого `<div` до его закрывающего `</div>`) на
  `<ChapterReading chapter={selectedChapter} scores={model.scores} question={EDITION_SPHERES[selectedChapter.kind].question} paperClassName={`${styles.paper} ${styles.chapterReading}`} preparing={preparing("главу")} practiceHref={selectedChapter.kind==="chapter_money"&&moneyPracticeAvailable?`/report/${resultId}/practice/money`:undefined} themes={chapterPreviews?.[selectedChapter.kind]}/>`;
- убрать импорты, ставшие ненужными (`tsc` подскажет, если `Paragraphs` больше нигде в файле не используется).

`apps/web/src/app/report/[resultId]/page.tsx`:
- импорты: расширить `import { typeCodeToDir } from "@grani/content";` до `import { chapterSeeds, typeCodeToDir } from "@grani/content";`, `import { typeName, unlockedKinds } from "@grani/core";` до `import { CHAPTER_KINDS, typeName, unlockedKinds } from "@grani/core";`, добавить `import { ChapterCards } from "@/components/ChapterCards";` и `import { isChapterCards } from "@/lib/chapter-view";`;
- перед `if (model && view.full) return …` добавить `const chapterPreviews = Object.fromEntries(CHAPTER_KINDS.map((kind) => [kind, chapterSeeds(kind).map((seed) => seed.title)]));` и передать `chapterPreviews={chapterPreviews}` в `<PersonalEdition … />`;
- в обычной странице заменить

```tsx
              {chapter.state === "ready" && (
                <>
                  <Paragraphs text={chapter.sections.text} />
                  <ul className="report-list">{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </>
              )}
```

на

```tsx
              {chapter.state === "ready" && (isChapterCards(chapter.sections) ? (
                <ChapterCards kind={chapter.kind} sections={chapter.sections} scores={result.scores} />
              ) : (
                <>
                  <Paragraphs text={chapter.sections.text} />
                  <ul className="report-list">{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </>
              ))}
```

`apps/web/src/app/report/[resultId]/practice/money/page.tsx`: добавить `import { ChapterCards } from "@/components/ChapterCards";` и `import { isChapterCards } from "@/lib/chapter-view";`; в блоке `{sections && …}` заменить `<Paragraphs text={sections.text} /><ul>{sections.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>` на `{isChapterCards(sections) ? <ChapterCards kind="chapter_money" sections={sections} scores={result.scores} /> : <><Paragraphs text={sections.text} /><ul>{sections.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></>}`. Для этой страницы автотеста нет (ей нужны моки практики и базы): её проверяют typecheck и ручной шаг 4 в Task 8.

- [ ] **Step 4: Run all web tests and typecheck**

Run: `pnpm exec vitest run apps/web` и `pnpm typecheck`
Expected: PASS; все шесть пакетов без ошибок типов (союз типов глав разобран везде).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): show the cards chapter and the real themes of an unbought chapter"
```

---

### Task 8: Сквозная проверка локально

**Files:** новых файлов нет (проверка и, при необходимости, мелкие правки вёрстки).

**Отклонение от спецификации:** автоматический e2e-сценарий покупки главы не добавляется — существующие e2e для атласа требуют отдельной тестовой базы на порту 5445 и своей оснастки, а воркер e2e работает с `AI_PROVIDER=none` и карточек не создаёт. Вместо него — SSR-тесты Task 6–7 и ручная проверка ниже.

- [ ] **Step 1: Run the whole automated suite**

Run: `pnpm test` и `pnpm typecheck` и `pnpm --filter @grani/web build`
Expected: все тесты PASS, типы чистые, сборка Next.js проходит. Если упал не относящийся к задаче тест — выписать его и не чинить в этой ветке.

- [ ] **Step 2: Start the local stack with the flag**

Run (в трёх терминалах): `pnpm dev:db`; `PERSONALITY_ATLAS_V2=1 pnpm dev:web`; воркер — `CHAPTER_CARDS_V2=1 pnpm dev:worker` (при `AI_PROVIDER=none` карточки не создаются — писатель пустой; это ожидаемо и проверяет откат).

- [ ] **Step 3: Check the fallback path and the old format**

Войти через `/api/dev/login?name=Check`, пройти тест, купить полный разбор и главу «Деньги» на фейковом провайдере (способ — в `docs/redesign/CODEX_REPORTS.md`, раздел «Как смотреть страницу локально»). С `AI_PROVIDER=none` глава должна открыться в прежнем формате (абзацы и советы), страница — без ошибок в консоли.

- [ ] **Step 4: Check the cards chapter visually**

Записать в базу главу формата 2 (SQL `insert into reports (result_id, kind, sections, source) values (…, 'chapter_money', <json>, 'ai')`, где `<json>` — результат `JSON.stringify({ version: 2, ...sampleOverview(), situations: …sampleSituation… })` из `@grani/ai/testing`), открыть `/report/<id>#edition-chapter-money` на 1440 и 390 px, затем `/report/<id>/practice/money`. Проверить: карточки читаются, липкая навигация не закрывает заголовки при переходе по хэшу, нет горизонтальной прокрутки на 320 px, ссылка на финансовый компас работает, вкладка «4 сферы» для ещё не купленной главы показывает шесть тем.

- [ ] **Step 5: Check contrast**

Прогнать проверку контраста (скрипт Playwright из сессии или любой аналог) по вкладке «4 сферы» с открытой главой-карточкой: нет элементов с контрастом ниже 4,5 : 1.

- [ ] **Step 6: Commit any fixes and report**

```bash
git add -A apps packages deploy docs
git commit -m "fix(web): polish the cards chapter after the local check"
```

(коммит только если были правки). Итог — сообщение владелице: что проверено вживую (формат 1, откат, карточки на двух ширинах, контраст), что нет (качество текста от YandexGPT — оценим после выкладки), и что для включения на сервере нужно `CHAPTER_CARDS_V2=1` и перезапуск воркера.
