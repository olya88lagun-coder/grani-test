# Карточки «В жизни» и живая памятка: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Для этого плана владелец выбрал `superpowers:executing-plans`: выполнять самому, по месту, без субагентов, один финальный разбор всей ветки.**

**Goal:** Платный «Личный разбор» получает пять карточек «В жизни», написанных ИИ под баллы человека (новый вид отчёта `life`), а эпиграф и пункт «Что хочу попробовать» новой памятки берутся из этих карточек.

**Architecture:** Карточка та же, что в главах (`SituationSchema`), поэтому генерация переиспользует `chapter-cards.ts` и `runPart` из `generate-chapter.ts`: тема-«семя», два запроса (3 + 2), пять попыток, замечания модели при повторе, мягкая последняя попытка. `life` открывается вместе с оплаченным `full` через `unlockedKinds`, в `PRODUCTS`, цены и `jobsFor` не входит. Если ИИ выключен или попытки исчерпаны, отчёт `life` не сохраняется, страница остаётся на статичных сценариях. Память (`atlas_drafts`) читается как есть: карточки влияют только на память, которой ещё нет в базе.

**Tech Stack:** TypeScript, zod 4, vitest 5, Next.js (apps/web), pg-boss (apps/worker), Drizzle + PGlite для тестов БД, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-13-personal-report-life-cards-design.md`. Контекст и ловушки: `docs/superpowers/handoff/2026-10-13-personal-report-life-cards-start.md`.

## Global Constraints

- Тексты для пользователей: русский, на «ты», нейтральный род («ты открыт» нельзя), без утверждений о прошлом читателя, без диагнозов. Новые видимые тексты утверждает владелец; в плане такие места помечены **[на утверждение]**.
- `life` не продукт: не входит в `PRODUCTS`, цены, список покупок, «4 сферы», письма «Готово: …». Покупать отдельно нельзя.
- Формат `sections` для `life`: `{ version: 1, situations: [5 карточек] }`, карточка = `SituationSchema` (`seed`, `title`, `scene`, `why`, `traits`, `say[1–3]`, `do`). Своих полей нет.
- Пять тем (`seed`, название, черты) заданы спецификацией: `change` «Планы внезапно изменились» (openness, conscientiousness); `critique` «Твою идею раскритиковали» (stability, openness); `deadline` «Срок подходит, работа не закончена» (conscientiousness, stability); `talk` «Предстоит непростой разговор» (agreeableness, extraversion); `method` «Коллега предлагает другой способ» (openness, agreeableness).
- Генерация: два запроса (3 + 2 темы), `CARD_ATTEMPTS = 5`, замечания модели при повторе, мягкая последняя попытка с пометкой `forgiven` в логе. В лог не попадают тексты ответа.
- Флаг `LIFE_CARDS_V1=1` (воркер и сайт), по умолчанию выключен. Включать оба вместе (см. Task 6 и «Выкладка»).
- Запасного текста для `life` нет: нет ИИ или все попытки исчерпаны → отчёт не сохраняется, уведомление не уходит.
- Сохранённый черновик памятки (`atlas_drafts`) никогда не обновляется автоматически.
- Миграция enum идёт отдельным коммитом; выкладка не зависит от включения флага.
- Каждое изменение: тест сначала (увидеть падение), потом код; перед PR полный `pnpm test` и `pnpm typecheck`. Два теста миграций БД (`practice-upgrade`, `personality-atlas-upgrade`) при падении по таймауту запускать отдельно.
- В `master` не вливать без явной команды «вливай». PR открывается с честным разделом «Не проверено».
- Windows + Git Bash: длинные файлы писать инструментом записи, не heredoc-ом.

## Review Focus

Что спецификация подразумевает, но отдельной задачей не описывает; у каждой строки есть тест в указанной задаче.

1. **Уже сохранённая памятка не меняется, даже когда карточки появились позже.** Ожидание: показывается текст из базы, фраза карточки не подставляется (Task 8: сервис, страница, PDF).
2. **Страница оплаты не ждёт `life`.** Если `life` попадёт в `jobsFor`, `getPurchaseView` будет вечно считать покупку неготовой, а повторная постановка будет ставить `life` вновь (Task 6).
3. **Повреждённый или устаревший JSON в отчёте `life`** (версия 2, четыре карточки, мусор). Ожидание: страница показывает статику, а не падает (Task 5).
4. **Задача `life` ушла при выключенном флаге воркера.** pg-boss завершит её «пропущено», а id `generate:<resultId>:life` потом не встанет заново. Ожидание: сайт ставит `life` только при включённом собственном флаге, воркер при выключенном флаге ничего не пишет (Task 4, Task 6).
5. **`life` не просачивается в чужие списки:** уведомление «Готово» не уходит, `life` нет в продуктах и главах, чужой или неоплаченный владелец карточек не видит (Task 3, Task 4, Task 5).

---

## Карта файлов

**Создать**
- `packages/content/src/life-seeds.ts` и `life-seeds.test.ts`: пять тем, `CardsKind`, `cardSeeds`/`cardsTitle`/`cardsSections`.
- `packages/ai/src/generate-life.ts` и `generate-life.test.ts`: два запроса, повтор, сборка пяти карточек.
- `packages/db/drizzle/0016_life_report_kind.sql` (+ snapshot и запись в журнале): `ALTER TYPE … ADD VALUE 'life'`.
- `apps/web/src/lib/life-report.ts` и `life-report.test.ts`: безопасный разбор отчёта `life`.
- `apps/web/src/server/life-cards.ts` и `life-cards.test.ts`: флаг сайта и ленивая постановка задачи.
- `apps/web/src/components/SituationCard.tsx`, `LifeCards.tsx`, `LifeCards.test.tsx`.
- `docs/redesign/GPT_LIFE_ICONS.md`: задание на пять значков.

**Изменить**
- `packages/core/src/reports.ts` (+test): вид `life`, доступ через `unlockedKinds`.
- `packages/ai/src/sections.ts`, `chapter-cards.ts`, `generate-chapter.ts` (экспорт `runPart`), `prompt.ts`, `testing.ts`, `index.ts` (+tests).
- `apps/worker/src/generate.ts`, `env.ts`, `main.ts`, `texts.ts`, `notify.ts` (+tests).
- `packages/db/src/reports.test.ts`.
- `apps/web/src/lib/report-view.ts`, `chapter-cover.ts`, `personality-atlas.ts` (+tests).
- `apps/web/src/server/payments-service.ts`, `payments-deps.ts`, `personality-atlas-service.ts`, `personality-atlas-pdf/source.ts` (+tests).
- `apps/web/src/components/ChapterCards.tsx`, `personality-atlas/PersonalEdition.tsx` (+tests), `apps/web/src/app/report/[resultId]/page.tsx` (+test).
- `deploy/env.example`, `deploy/server-setup.md`.

---

### Task 0: Ветка

- [ ] **Step 1: Закоммитить этот план на текущей docs-ветке**

```bash
git add docs/superpowers/plans/2026-10-13-personal-report-life-cards.md
git commit -m "docs: implementation plan for personal report life cards"
```

- [ ] **Step 2: Создать рабочую ветку для кода**

```bash
git switch -c feat/personal-report-life-cards
```

Ожидается: ветка `feat/personal-report-life-cards` от `docs/personal-report-life-cards` (в ней спецификация, задание и план).

---

### Task 1: Темы «В жизни» в пакете content

**Files:**
- Create: `packages/content/src/life-seeds.ts`
- Create: `packages/content/src/life-seeds.test.ts`
- Modify: `packages/content/src/index.ts`

**Interfaces:**
- Produces:
  - `type CardsKind = ChapterKind | "life"`
  - `const LIFE_TITLE: string`, `const LIFE_SECTIONS: readonly TraitSection[]`
  - `lifeSeeds(): readonly ChapterSeed[]` (ровно 5)
  - `cardSeeds(kind: CardsKind): readonly ChapterSeed[]`, `cardsTitle(kind: CardsKind): string`, `cardsSections(kind: CardsKind): readonly TraitSection[]`

- [ ] **Step 1: Написать падающий тест**

`packages/content/src/life-seeds.test.ts`:

```ts
import { TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterSeeds } from "./chapter-seeds";
import { CHAPTER_SECTIONS, CHAPTER_TITLES } from "./labels";
import { cardSeeds, cardsSections, cardsTitle, LIFE_SECTIONS, LIFE_TITLE, lifeSeeds } from "./life-seeds";
import { findStopWords } from "./safety";

const APPROVED = [
  ["change", "Планы внезапно изменились", ["openness", "conscientiousness"]],
  ["critique", "Твою идею раскритиковали", ["stability", "openness"]],
  ["deadline", "Срок подходит, работа не закончена", ["conscientiousness", "stability"]],
  ["talk", "Предстоит непростой разговор", ["agreeableness", "extraversion"]],
  ["method", "Коллега предлагает другой способ", ["openness", "agreeableness"]],
] as const;

describe("lifeSeeds", () => {
  test("are the five approved situations with their titles and traits, in order", () => {
    expect(lifeSeeds().map((seed) => [seed.id, seed.title, seed.traits])).toEqual(APPROVED.map(([id, title, traits]) => [id, title, traits]));
  });

  test("ids and titles are unique, ids fit the id format, focus texts are descriptive", () => {
    const seeds = lifeSeeds();

    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(5);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(5);
    for (const seed of seeds) {
      expect(seed.id).toMatch(/^[a-z]{2,12}$/);
      expect(seed.title.length).toBeGreaterThanOrEqual(8);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.focus.length).toBeGreaterThan(40);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
    }
  });

  test("the situations draw on all five traits", () => {
    expect(new Set(lifeSeeds().flatMap((seed) => seed.traits))).toEqual(new Set(TRAITS));
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of lifeSeeds()) expect(findStopWords(`${seed.title} ${seed.focus}`), seed.id).toEqual([]);
  });
});

describe("card topics", () => {
  test("a chapter keeps its own seeds, title and one library section", () => {
    expect(cardSeeds("chapter_money")).toEqual(chapterSeeds("chapter_money"));
    expect(cardsTitle("chapter_money")).toBe(CHAPTER_TITLES.chapter_money);
    expect(cardsSections("chapter_money")).toEqual([CHAPTER_SECTIONS.chapter_money]);
  });

  test("life has its own seeds, a title and three library sections", () => {
    expect(cardSeeds("life")).toEqual(lifeSeeds());
    expect(cardsTitle("life")).toBe(LIFE_TITLE);
    expect(cardsSections("life")).toEqual(LIFE_SECTIONS);
    expect(LIFE_SECTIONS).toEqual(["work", "conflict", "stress"]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm vitest run packages/content/src/life-seeds.test.ts`
Expected: FAIL (`Cannot find module './life-seeds'`).

- [ ] **Step 3: Реализация**

`packages/content/src/life-seeds.ts`:

```ts
import type { ChapterKind } from "@grani/core";
import { chapterSeeds, type ChapterSeed } from "./chapter-seeds";
import type { TraitSection } from "./keys";
import { CHAPTER_SECTIONS, CHAPTER_TITLES } from "./labels";

// Карточки пишутся для глав и для вкладки «В жизни»; у второй своя тема, свои блоки библиотеки и нет обзора
export type CardsKind = ChapterKind | "life";

export const LIFE_TITLE = "Жизненные ситуации";
// Пять сценариев ближе всего к работе, разногласиям и стрессу: из этих разделов библиотеки берутся блоки по каждой черте
export const LIFE_SECTIONS: readonly TraitSection[] = ["work", "conflict", "stress"];

// Темы задаёт редакция, названия те же, что в статичном списке вкладки: пользователи видят знакомые ситуации.
// Первые три идут в один запрос к модели, последние две — в другой
const LIFE_SEEDS: readonly ChapterSeed[] = [
  { id: "change", title: "Планы внезапно изменились", focus: "Как человек реагирует, когда привычный план или договорённость меняются в последний момент, и что помогает быстро собрать новый порядок действий.", traits: ["openness", "conscientiousness"] },
  { id: "critique", title: "Твою идею раскритиковали", focus: "Как человек слышит критику своей идеи или работы, что хочется ответить первым и как отделить полезное замечание от общего суждения.", traits: ["stability", "openness"] },
  { id: "deadline", title: "Срок подходит, работа не закончена", focus: "Что происходит, когда срок близко, а работа не закончена: тянется ли желание улучшать, растёт ли напряжение и как выделить то, что нужно к сроку.", traits: ["conscientiousness", "stability"] },
  { id: "talk", title: "Предстоит непростой разговор", focus: "Как человек готовится к непростому разговору и ведёт его: что говорит первым, как слушает и как не уйти от главного.", traits: ["agreeableness", "extraversion"] },
  { id: "method", title: "Коллега предлагает другой способ", focus: "Как человек встречает предложение сделать то же дело другим способом: когда стоит попробовать, когда настоять на своём и как об этом сказать.", traits: ["openness", "agreeableness"] },
];

export const lifeSeeds = (): readonly ChapterSeed[] => LIFE_SEEDS;

export function cardSeeds(kind: CardsKind): readonly ChapterSeed[] {
  return kind === "life" ? LIFE_SEEDS : chapterSeeds(kind);
}

export function cardsTitle(kind: CardsKind): string {
  return kind === "life" ? LIFE_TITLE : CHAPTER_TITLES[kind];
}

export function cardsSections(kind: CardsKind): readonly TraitSection[] {
  return kind === "life" ? LIFE_SECTIONS : [CHAPTER_SECTIONS[kind]];
}
```

`packages/content/src/index.ts`: добавить строку после `export * from "./chapter-seeds";`:

```ts
export * from "./life-seeds";
```

- [ ] **Step 4: Тест проходит**

Run: `pnpm vitest run packages/content/src/life-seeds.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Закоммитить**

```bash
git add packages/content/src/life-seeds.ts packages/content/src/life-seeds.test.ts packages/content/src/index.ts
git commit -m "feat(content): five editorial situations for the life cards"
```

---

### Task 2: Генерация пяти карточек в пакете ai

**Files:**
- Modify: `packages/ai/src/sections.ts`, `packages/ai/src/sections.test.ts`
- Modify: `packages/ai/src/chapter-cards.ts`, `packages/ai/src/chapter-cards.test.ts`
- Modify: `packages/ai/src/generate-chapter.ts` (экспорт `runPart`)
- Modify: `packages/ai/src/testing.ts`, `packages/ai/src/index.ts`
- Create: `packages/ai/src/generate-life.ts`, `packages/ai/src/generate-life.test.ts`

**Interfaces:**
- Consumes: `CardsKind`, `cardSeeds`, `cardsTitle`, `cardsSections`, `lifeSeeds` из `@grani/content` (Task 1).
- Produces:
  - `sections.ts`: `type Situation`, `const LifeCardsSchema`, `type LifeSections = { version: 1; situations: Situation[] }`, `parseLifeCards(value: unknown): LifeSections | null`
  - `chapter-cards.ts`: `ChapterCardsContext.kind: CardsKind`; `partSeeds(kind: CardsKind, part)`; для `life` части `situations_a` (3 темы) и `situations_b` (2 темы)
  - `generate-chapter.ts`: `export async function runPart(...)` (без изменения тела)
  - `generate-life.ts`: `generateLifeCards(writer: ReportWriter, ctx: { library: Library; result: PersonalScores }, options?): Promise<{ sections: LifeSections; attempts: number } | null>`
  - `testing.ts`: `cardsStubWriter` корректно отвечает на части `life`

- [ ] **Step 1: Схема `life`, падающий тест**

В `packages/ai/src/sections.test.ts` дописать (импорт `parseLifeCards` добавить в существующую строку импорта из `./sections`):

```ts
describe("parseLifeCards", () => {
  const life = (overrides: Record<string, unknown> = {}) => ({ version: 1, situations: ["sa", "sb", "sc", "sd", "se"].map(situation), ...overrides });

  test("accepts five cards of version 1", () => {
    expect(parseLifeCards(life())?.situations).toHaveLength(5);
  });

  test("rejects four or six cards, another version, extra fields and a chapter-style object", () => {
    expect(parseLifeCards(life({ situations: ["sa", "sb", "sc", "sd"].map(situation) }))).toBeNull();
    expect(parseLifeCards(life({ situations: ["sa", "sb", "sc", "sd", "se", "sf"].map(situation) }))).toBeNull();
    expect(parseLifeCards(life({ version: 2 }))).toBeNull();
    expect(parseLifeCards(life({ headline: long(60) }))).toBeNull();
    expect(parseLifeCards(cards())).toBeNull();
    expect(parseLifeCards(null)).toBeNull();
  });
});
```

Run: `pnpm vitest run packages/ai/src/sections.test.ts`
Expected: FAIL (`parseLifeCards is not a function`).

- [ ] **Step 2: Реализовать схему**

В `packages/ai/src/sections.ts`, после `export const ChapterCardsSchema = …`:

```ts
// Вкладка «В жизни»: те же карточки без обзора и ловушек, ровно пять
export const LIFE_SITUATIONS = 5;
export const LifeCardsSchema = z.strictObject({ version: z.literal(1), situations: z.array(SituationSchema).length(LIFE_SITUATIONS) });
```

В блок типов добавить:

```ts
export type Situation = z.infer<typeof SituationSchema>;
export type LifeSections = z.infer<typeof LifeCardsSchema>;
```

После `parseChapterCards`:

```ts
export function parseLifeCards(value: unknown): LifeSections | null {
  const parsed = LifeCardsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

Run: `pnpm vitest run packages/ai/src/sections.test.ts`
Expected: PASS.

- [ ] **Step 3: Падающие тесты на обобщённые части**

В `packages/ai/src/chapter-cards.test.ts` дописать (добавить импорты `traitBlock` из `@grani/content`, `traitLevel` из `@grani/core`):

```ts
describe("life situations", () => {
  const LIFE: ChapterCardsContext = { library: getLibrary(), kind: "life", result: SAMPLE_SCORES };

  test("five themes go in two groups, three and two", () => {
    expect(partSeeds("life", "situations_a").map((seed) => seed.id)).toEqual(["change", "critique", "deadline"]);
    expect(partSeeds("life", "situations_b").map((seed) => seed.id)).toEqual(["talk", "method"]);
    expect(partSeeds("life", "overview")).toEqual([]);
  });

  test("the prompt carries the life themes and, per trait, the work, conflict and stress blocks", () => {
    const prompt = buildChapterPartPrompt("situations_b", LIFE);
    const user = JSON.parse(prompt.user) as { chapter: string; seeds: { id: string }[]; blocks: Record<string, string> };

    expect(user.chapter).toBe("Жизненные ситуации");
    expect(user.seeds.map((seed) => seed.id)).toEqual(["talk", "method"]);
    expect(Object.keys(user.blocks)).toHaveLength(5);
    const level = traitLevel(SAMPLE_SCORES.scores.openness);
    expect(user.blocks.openness).toBe((["work", "conflict", "stress"] as const).map((section) => traitBlock(getLibrary(), "openness", level, section)).join("\n\n"));
    expect(blockTexts(LIFE)).toHaveLength(5);
  });

  test("a chapter prompt is unchanged: one section per trait", () => {
    const user = JSON.parse(buildChapterPartPrompt("situations_a", CTX).user) as { blocks: Record<string, string> };
    const level = traitLevel(SAMPLE_SCORES.scores.openness);

    expect(user.blocks.openness).toBe(traitBlock(getLibrary(), "openness", level, "money"));
  });
});
```

Run: `pnpm vitest run packages/ai/src/chapter-cards.test.ts`
Expected: FAIL (тип `"life"` не принимается, `partSeeds("life", …)` возвращает `[]`/падает).

- [ ] **Step 4: Обобщить `chapter-cards.ts`**

Правки в `packages/ai/src/chapter-cards.ts`:

1. Строка 1 → `import { cardSeeds, cardsSections, cardsTitle, findStopWords, traitBlock, type CardsKind, type ChapterSeed, type Library } from "@grani/content";`
2. Строка 2 → `import { TRAITS, traitLevel } from "@grani/core";`
3. `ChapterCardsContext`: `kind: CardsKind`.
4. `partSeeds`: параметр `kind: CardsKind`, внутри `const seeds = cardSeeds(kind);`.
5. `blocksOf`:

```ts
// Для глав один раздел библиотеки на черту, для «В жизни» три раздела подряд
const blocksOf = (ctx: ChapterCardsContext): Record<string, string> =>
  Object.fromEntries(
    TRAITS.map((trait) => [
      trait,
      cardsSections(ctx.kind)
        .map((section) => traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), section))
        .join("\n\n"),
    ]),
  );
```

6. В `buildChapterPartPrompt`: `chapter: cardsTitle(ctx.kind)` вместо `CHAPTER_TITLES[ctx.kind]`.

Run: `pnpm vitest run packages/ai/src/chapter-cards.test.ts`
Expected: PASS (включая прежние тесты глав).

- [ ] **Step 5: Падающие тесты на генератор**

`packages/ai/src/generate-life.test.ts`:

```ts
import { lifeSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { partSeeds } from "./chapter-cards";
import { generateLifeCards } from "./generate-life";
import { cardsStubWriter, SAMPLE_SCORES, sampleSituation } from "./testing";

const CTX = { library: getLibrary(), result: SAMPLE_SCORES };
const situationsOf = (part: "situations_a" | "situations_b", patch: (card: ReturnType<typeof sampleSituation>) => unknown = (card) => card) =>
  JSON.stringify({ situations: partSeeds("life", part).map((seed) => patch(sampleSituation(seed))) });

describe("generateLifeCards", () => {
  test("makes two requests and assembles five cards in the editorial order", async () => {
    const stub = cardsStubWriter();

    const result = await generateLifeCards(stub, CTX);

    expect(stub.calls).toHaveLength(2);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.version).toBe(1);
    expect(result?.sections.situations.map((card) => card.seed)).toEqual(lifeSeeds().map((seed) => seed.id));
  });

  test("retries a broken part without repeating the other one and names the part in the log", async () => {
    const log = vi.fn();
    const stub = cardsStubWriter({ situations_a: ["не json"] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(3);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ kind: "life", part: "situations_a", attempt: 1, reason: "not_json" }));
  });

  test("a retry carries the concrete remark about the previous answer", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}"] });

    await generateLifeCards(stub, CTX);

    const fixes = stub.calls.map((call) => (JSON.parse(call.user) as { fix?: string }).fix).filter(Boolean);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toContain("situations");
  });

  test("gives up with null after five rejected attempts, never returning a half-made set", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    expect(await generateLifeCards(stub, CTX)).toBeNull();
  });

  test("the last attempt forgives a gendered form and says so in the log", async () => {
    const log = vi.fn();
    const gendered = situationsOf("situations_a", (card) => ({ ...card, why: "Здесь сходятся твои черты: ты открыт новому, поэтому важно заранее знать свой ответ." }));
    const stub = cardsStubWriter({ situations_a: [gendered, gendered, gendered, gendered, gendered] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(result?.attempts).toBe(5);
    expect(log).toHaveBeenCalledWith("chapter part accepted with remarks", expect.objectContaining({ kind: "life", part: "situations_a", attempt: 5, forgiven: expect.arrayContaining(["gendered"]) }));
  });

  test("when the second group repeats the first group's advice it is asked again", async () => {
    const log = vi.fn();
    const first = sampleSituation(lifeSeeds()[0]!);
    const repeating = JSON.stringify({ situations: partSeeds("life", "situations_b").map((seed, index) => (index === 0 ? { ...sampleSituation(seed), do: first.do } : sampleSituation(seed))) });
    const stub = cardsStubWriter({ situations_b: [repeating] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(log).toHaveBeenCalledWith("chapter part repeats another", expect.objectContaining({ kind: "life", part: "situations_b" }));
    expect(stub.calls).toHaveLength(3);
    expect(result?.sections.situations[3]?.do).not.toBe(first.do);
  });
});
```

Run: `pnpm vitest run packages/ai/src/generate-life.test.ts`
Expected: FAIL (`Cannot find module './generate-life'`).

- [ ] **Step 6: Заглушка модели понимает `life`**

В `packages/ai/src/testing.ts`:

1. Импорт: `import { chapterSeeds, lifeSeeds } from "@grani/content";`
2. После `SAMPLE_ACTIONS` добавить:

```ts
// Совет для каждой из пяти ситуаций «В жизни». «critique» совпадает с темой главы «Конфликты» и берёт её совет: внутри одного отчёта советы всё равно разные
const LIFE_SAMPLE_ACTIONS: Readonly<Record<string, string>> = {
  change: "Когда план сорвался, выпиши три обязательных пункта и один, который можно сдвинуть на неделю.",
  deadline: "За два дня до срока отдели то, без чего нельзя сдать, и закрой это первым, остальное запиши на потом.",
  talk: "Перед разговором запиши одну главную мысль и первую фразу и скажи её в первые полминуты встречи.",
  method: "Выбери один небольшой участок работы и попробуй чужой способ только на нём, потом сравни результат.",
};
```

3. В `actionFor` последней строкой вместо `return undefined;`: `return LIFE_SAMPLE_ACTIONS[seedId];`
4. `FIRST_SEEDS`: `new Set([...CHAPTER_KINDS.map((kind) => chapterSeeds(kind)[0]!.id), lifeSeeds()[0]!.id])`

- [ ] **Step 7: Реализовать генератор**

В `packages/ai/src/generate-chapter.ts` заменить `async function runPart<T>(` на `export async function runPart<T>(` (тело не менять).

`packages/ai/src/generate-life.ts`:

```ts
import type { Library } from "@grani/content";
import { blockTexts, partSeeds, validateSituations, type ChapterCardsContext, type ChapterPart, type SituationsPart } from "./chapter-cards";
import { repeatsAny } from "./chapter-overlap";
import type { GenerateLog, ReportWriter } from "./generate";
import { CARD_ATTEMPTS, runPart } from "./generate-chapter";
import type { PersonalScores } from "./input";
import { parseLifeCards, type LifeSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };

function assembleLifeCards(a: SituationsPart, b: SituationsPart): LifeSections | null {
  const situations = [...a.situations, ...b.situations];
  // Одинаковые названия значат, что модель повторила карточку, — такой набор не сохраняем
  if (new Set(situations.map((card) => card.title)).size !== situations.length) return null;
  return parseLifeCards({ version: 1, situations });
}

// Пять карточек «В жизни»: два запроса параллельно (3 + 2 темы). Если какая-то часть не получилась за все попытки,
// возвращается null: запасного текста у вкладки нет, на странице остаётся статичный вариант
export async function generateLifeCards(
  writer: ReportWriter,
  rawCtx: { library: Library; result: PersonalScores },
  rawOptions: Options = {},
): Promise<{ sections: LifeSections; attempts: number } | null> {
  const ctx: ChapterCardsContext = { ...rawCtx, kind: "life" };
  const options: Options = { attempts: CARD_ATTEMPTS, ...rawOptions };
  const idsOf = (part: ChapterPart) => partSeeds("life", part).map((seed) => seed.id);
  const blocks = blockTexts(ctx);
  const [a, firstB] = await Promise.all([
    runPart(writer, "situations_a", ctx, (raw, final) => validateSituations(raw, idsOf("situations_a"), { blocks }, final), options),
    runPart(writer, "situations_b", ctx, (raw, final) => validateSituations(raw, idsOf("situations_b"), { blocks }, final), options),
  ]);
  if (!a || !firstB) return null;

  // Группы пишутся порознь и могут дать одинаковый совет: вторую просим ещё раз, зная советы первой
  let b = firstB;
  const actionsA = a.value.situations.map((card) => card.do);
  if (b.value.situations.some((card) => repeatsAny(card.do, actionsA))) {
    options.log?.("chapter part repeats another", { kind: "life", writer: writer.name, part: "situations_b" });
    const again = await runPart(writer, "situations_b", ctx, (raw, final) => validateSituations(raw, idsOf("situations_b"), { blocks, avoid: actionsA }, final), options);
    if (again) b = { value: again.value, attempts: Math.max(b.attempts, again.attempts) };
  }

  const sections = assembleLifeCards(a.value, b.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: "life", writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: Math.max(a.attempts, b.attempts) };
}
```

В `packages/ai/src/index.ts` добавить после `export * from "./generate-chapter";`:

```ts
export * from "./generate-life";
```

- [ ] **Step 8: Все тесты пакета проходят**

Run: `pnpm vitest run packages/ai packages/content`
Expected: PASS. Если `typecheck` пакета ругается на `ChapterKind`-места, поправить: `pnpm --filter @grani/ai typecheck`.

- [ ] **Step 9: Закоммитить**

```bash
git add packages/ai packages/content
git commit -m "feat(ai): generate the five life cards with the chapter rules"
```

---

### Task 3: Вид отчёта `life`: ядро, типы, миграция

**Files:**
- Modify: `packages/core/src/reports.ts`, `packages/core/src/reports.test.ts`
- Modify: `packages/ai/src/sections.ts`, `packages/ai/src/sections.test.ts`, `packages/ai/src/prompt.ts`
- Modify: `apps/worker/src/texts.ts`, `apps/worker/src/texts.test.ts`, `apps/worker/src/notify.ts`, `apps/worker/src/notify.test.ts`, `apps/worker/src/generate.ts`
- Create: `packages/db/drizzle/0016_life_report_kind.sql` (+ `meta/`)
- Modify: `packages/db/src/reports.test.ts`

**Interfaces:**
- Consumes: `LifeCardsSchema`, `LifeSections` (Task 2).
- Produces: `ReportKind` включает `"life"`; `unlockedKinds(["full"])` содержит `"life"`; `ReportSections["life"] = LifeSections`; `parseSections("life", value)`; в БД enum `report_kind` содержит `life`.

**Коммит 1 (код, без миграции), потом коммит 2 (миграция).**

- [ ] **Step 1: Падающие тесты ядра**

В `packages/core/src/reports.test.ts`: импорт `isProduct` из `./pricing`; заменить тест «collects everything the purchases opened» и добавить:

```ts
  test("collects everything the purchases opened, the life cards come with the full report", () => {
    expect([...unlockedKinds(["full", "chapters_all"])].sort()).toEqual(["chapter_conflict", "chapter_money", "chapter_relationships", "chapter_stress", "full", "life"]);
  });

  test("the life cards are not sold and open only with the full report", () => {
    expect(isReportKind("life")).toBe(true);
    expect(isProduct("life")).toBe(false);
    expect(reportKindsFor("full")).toEqual(["full"]);
    expect(unlockedKinds(["full"]).has("life")).toBe(true);
    expect(unlockedKinds(["chapter_money"]).has("life")).toBe(false);
    expect(unlockedKinds(["pair"]).has("life")).toBe(false);
    expect(unlockedKinds([]).has("life")).toBe(false);
  });
```

В `packages/ai/src/sections.test.ts`:

```ts
test("parseSections knows the life kind", () => {
  const valid = { version: 1, situations: ["sa", "sb", "sc", "sd", "se"].map(situation) };

  expect(parseSections("life", valid)?.situations).toHaveLength(5);
  expect(parseSections("life", { ...valid, version: 2 })).toBeNull();
});
```

В `apps/worker/src/notify.test.ts` в `describe("report_ready")`:

```ts
  test("says nothing about the life cards: they appear on the page by themselves", async () => {
    const owner = await seedUserWithResult(db, { externalId: "310" });
    const { report } = await saveReport(db, { target: { resultId: owner.resultId }, kind: "life", sections: {}, source: "ai" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);

    expect(telegram).not.toHaveBeenCalled();
  });
```

(тест требует миграции, поэтому он упадёт на Step 6, а не раньше; писать сейчас, проверять после миграции).

Run: `pnpm vitest run packages/core/src/reports.test.ts packages/ai/src/sections.test.ts`
Expected: FAIL.

- [ ] **Step 2: Ядро**

`packages/core/src/reports.ts`:

```ts
export const REPORT_KINDS = ["full", "friends", "chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships", "pair", "life"] as const;
```

Порядок значений совпадает с порядком в enum БД (новое значение добавляется в конец). Заменить `unlockedKinds`:

```ts
// Карточки «В жизни» не продаются: открываются вместе с полным разбором
export function unlockedKinds(owned: readonly Product[]): ReadonlySet<ReportKind> {
  const kinds = new Set(owned.flatMap(reportKindsFor));
  if (kinds.has("full")) kinds.add("life");
  return kinds;
}
```

`reportKindsFor` не менять: через него `jobsFor` строит задачи оплаты, `life` туда попадать не должен.

- [ ] **Step 3: Типы ai и воркера (чтобы пакеты собирались)**

`packages/ai/src/sections.ts`: тип `ReportSections` →

```ts
export type ReportSections = { full: FullSections; friends: FriendsSections; pair: PairSections; life: LifeSections } & Record<ChapterKind, ChapterSections>;
```

в `SECTION_SCHEMAS` добавить `life: LifeCardsSchema,`.

`packages/ai/src/prompt.ts`: `const SHAPES: Readonly<Record<Exclude<ReportKind, "life">, string>> = {` (у `life` нет единого запроса: промпты частей строит `chapter-cards.ts`).

`apps/worker/src/texts.ts`:

```ts
type AnnouncedKind = Exclude<ReportKind, "life">;
const READY_TITLES: Readonly<Record<AnnouncedKind, string>> = { … без изменений … };

export function reportReadyText(kind: AnnouncedKind, url: string): string {
```

`apps/worker/src/notify.ts`, в `notifyReportReady` сразу после `if (!report) return true;`:

```ts
  // Карточки «В жизни» появляются на странице сами, сообщения о них нет
  if (report.kind === "life") return true;
```

`apps/worker/src/generate.ts`, в `buildInput` сразу после блока `if (job.kind === "pair") {…}`:

```ts
  // Карточки «В жизни» идут отдельным путём без общего входа и без запасного текста (см. runLife)
  if (job.kind === "life") return null;
```

Run: `pnpm vitest run packages/core packages/ai && pnpm typecheck`
Expected: PASS и зелёный typecheck. Если typecheck укажет ещё места с `Record<ReportKind, …>`, исправить так же (`Exclude<…, "life">` или явная запись для `life`); проверить `grep -rn "ReportKind" e2e`.

- [ ] **Step 4: Закоммитить код (без теста уведомления: он зависит от миграции)**

```bash
git add packages/core packages/ai apps/worker/src/texts.ts apps/worker/src/texts.test.ts apps/worker/src/notify.ts apps/worker/src/generate.ts
git commit -m "feat: life report kind that opens with the full report and never announces itself"
```

- [ ] **Step 5: Падающий тест БД**

В `packages/db/src/reports.test.ts` в `describe("saveReport")`:

```ts
  test("stores the life cards beside the other reports of a result", async () => {
    await saveReport(db, { target: { resultId }, kind: "full", sections: {}, source: "ai" });
    const life = await saveReport(db, { target: { resultId }, kind: "life", sections: { version: 1 }, source: "ai" });

    expect(life.created).toBe(true);
    expect((await getReport(db, { resultId }, "life"))?.sections).toEqual({ version: 1 });
    expect((await listReports(db, { resultId })).map((report) => report.kind).sort()).toEqual(["full", "life"]);
  });
```

Run: `pnpm vitest run packages/db/src/reports.test.ts`
Expected: FAIL (`invalid input value for enum report_kind: "life"`).

- [ ] **Step 6: Миграция**

```bash
pnpm --filter @grani/db exec drizzle-kit generate --name life_report_kind
```

Проверить: создан `packages/db/drizzle/0016_life_report_kind.sql` с единственным оператором

```sql
ALTER TYPE "public"."report_kind" ADD VALUE 'life';
```

плюс `meta/0016_snapshot.json` и запись `0016_life_report_kind` в `meta/_journal.json`. Если генератор предложил что-то ещё (переименования, другие изменения), остановиться и разобраться, не принимать вслепую.

Run: `pnpm vitest run packages/db/src/reports.test.ts apps/worker/src/notify.test.ts`
Expected: PASS (новый тест БД и тест уведомления).

- [ ] **Step 7: Полная проверка и коммит миграции отдельно**

Run: `pnpm vitest run packages/db apps/worker` (если `practice-upgrade` или `personality-atlas-upgrade` упали по таймауту, запустить их отдельно: `pnpm vitest run packages/db/src/practice-upgrade.test.ts`, затем `pnpm vitest run packages/db/src/personality-atlas-upgrade.test.ts`).

```bash
git add packages/db apps/worker/src/notify.test.ts
git commit -m "feat(db): add the life value to the report_kind enum"
```

---

### Task 4: Воркер: флаг `LIFE_CARDS_V1` и задача `life`

**Files:**
- Modify: `apps/worker/src/env.ts`, `apps/worker/src/env.test.ts`
- Modify: `apps/worker/src/generate.ts`, `apps/worker/src/generate.test.ts`
- Modify: `apps/worker/src/main.ts`

**Interfaces:**
- Consumes: `generateLifeCards` (Task 2), `unlockedKinds` и вид `life` (Task 3).
- Produces: `WorkerEnv.lifeCardsV1: boolean`; `GenerateDeps.lifeCardsV1?: boolean`; `runGenerate({ kind: "life", resultId }, deps)` сохраняет отчёт `life` с `source: "ai"` либо не делает ничего.

- [ ] **Step 1: Падающие тесты окружения**

В `apps/worker/src/env.test.ts`: в двух существующих `toEqual` добавить `lifeCardsV1: false` рядом с `chapterCardsV2: false`; добавить:

```ts
test("the life cards are off unless LIFE_CARDS_V1 is 1", () => {
  expect(readWorkerEnv(BASE).lifeCardsV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "0" }).lifeCardsV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "1" }).lifeCardsV1).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "yes" })).toThrow(/LIFE_CARDS_V1/);
});
```

Run: `pnpm vitest run apps/worker/src/env.test.ts` — Expected: FAIL.

- [ ] **Step 2: Окружение**

`apps/worker/src/env.ts`: в схему после `CHAPTER_CARDS_V2`: `LIFE_CARDS_V1: z.enum(["0", "1"]).optional(),`; в тип `WorkerEnv` добавить `lifeCardsV1: boolean`; в возвращаемый объект `lifeCardsV1: env.LIFE_CARDS_V1 === "1",`.

Run: `pnpm vitest run apps/worker/src/env.test.ts` — Expected: PASS.

- [ ] **Step 3: Падающие тесты задачи**

В `apps/worker/src/generate.test.ts` добавить в конец файла (импорт `parseSections` уже есть):

```ts
describe("life cards", () => {
  const lifeJob = () => ({ kind: "life" as const, resultId: anna.resultId });

  beforeEach(() => {
    deps.lifeCardsV1 = true;
  });

  test("a paid owner gets five cards written by the model and no announcement", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);

    const report = await getReport(db, { resultId: anna.resultId }, "life");
    expect(report?.source).toBe("ai");
    expect(parseSections("life", report?.sections)?.situations).toHaveLength(5);
    expect(stub.calls).toHaveLength(2);
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("without the flag nothing is asked and nothing is saved", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;
    deps.lifeCardsV1 = false;

    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("without the model nothing is saved: the page keeps the static scenarios", async () => {
    await payFull();
    deps.writer = null;

    await runGenerate(lifeJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("without the paid full report the model is not asked and nothing is saved", async () => {
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
  });

  test("when every attempt fails nothing is saved and the failure is logged without the answer text", async () => {
    await payFull();
    deps.writer = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    await runGenerate(lifeJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "life")).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("warn", "life cards failed", { kind: "life" });
  });

  test("a second run does not ask the model again", async () => {
    await payFull();
    const stub = cardsStubWriter();
    deps.writer = stub;

    await runGenerate(lifeJob(), deps);
    await runGenerate(lifeJob(), deps);

    expect(stub.calls).toHaveLength(2);
  });
});
```

Run: `pnpm vitest run apps/worker/src/generate.test.ts` — Expected: FAIL (отчёт не создаётся; `lifeCardsV1` не существует в типе).

- [ ] **Step 4: Реализация**

`apps/worker/src/generate.ts`:

1. Импорты: добавить `generateLifeCards` в импорт из `@grani/ai`; добавить `unlockedKinds` в импорт из `@grani/core`.
2. В `GenerateDeps` после `chapterCardsV2`:

```ts
  // Карточки «В жизни»; по умолчанию выключено
  lifeCardsV1?: boolean;
```

3. После `usesCards` добавить:

```ts
type LifeJob = { kind: "life"; resultId: string };
const isLife = (job: GenerateJob): job is LifeJob => job.kind === "life";

// У карточек «В жизни» нет запасного текста: запасной вариант — статичные сценарии на странице.
// Поэтому без ИИ, без флага, без оплаченного разбора или после исчерпанных попыток отчёт просто не сохраняется
async function runLife(job: LifeJob, deps: GenerateDeps): Promise<void> {
  if (deps.lifeCardsV1 !== true || deps.writer === null) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const target = { resultId: job.resultId };
  const result = await getResult(deps.db, job.resultId);
  // Сайт проверил доступ при постановке задачи; проверяем ещё раз — между ними могло пройти время
  if (!result || !unlockedKinds(await listOwnedProducts(deps.db, target)).has("life")) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const cards = await generateLifeCards(deps.writer, { library: deps.library, result }, { log: (message, extra) => deps.log("warn", message, extra) });
  if (!cards) {
    deps.log("warn", "life cards failed", { kind: job.kind });
    return;
  }
  const { created } = await saveReport(deps.db, { target, kind: "life", sections: cards.sections, source: "ai" });
  deps.log("info", "report generated", { kind: job.kind, source: "ai", attempts: cards.attempts, created });
}
```

4. В `runGenerate`, сразу после `if (await getReport(deps.db, target, job.kind)) return;`:

```ts
  if (isLife(job)) return runLife(job, deps);
```

`apps/worker/src/main.ts`: в вызов `runGenerate` добавить `lifeCardsV1: env.lifeCardsV1`; в `log("info", "worker started", …)` добавить `lifeCardsV1: env.lifeCardsV1`.

Run: `pnpm vitest run apps/worker && pnpm --filter @grani/worker typecheck`
Expected: PASS.

- [ ] **Step 5: Закоммитить**

```bash
git add apps/worker
git commit -m "feat(worker): write the life cards behind LIFE_CARDS_V1 without a fallback"
```

---

### Task 5: Сайт: отчёт `life` в представлении страницы

**Files:**
- Create: `apps/web/src/lib/life-report.ts`, `apps/web/src/lib/life-report.test.ts`
- Modify: `apps/web/src/lib/report-view.ts`, `apps/web/src/lib/report-view.test.ts`
- Modify: фикстуры `ReportPageView`, которые укажет typecheck: `components/personality-atlas/PersonalEdition.test.tsx`, `PersonalEdition.covers.test.tsx`

**Interfaces:**
- Consumes: `parseSections("life", …)`, `LifeSections` (Task 3), `lifeSeeds` (Task 1), `sampleSituation` из `@grani/ai/testing`.
- Produces: `parseLifeReport(report: Pick<ReportRecord, "sections"> | null | undefined): LifeSections | null`; `ReportPageView.life: LifeSections | null` (не `null` только если у владельца открыт `life` и отчёт корректен); `life` не влияет на `preparing`.

- [ ] **Step 1: Падающие тесты**

`apps/web/src/lib/life-report.test.ts`:

```ts
import { lifeSeeds } from "@grani/content";
import { sampleSituation } from "@grani/ai/testing";
import { describe, expect, test } from "vitest";
import { parseLifeReport } from "./life-report";

const valid = { version: 1, situations: lifeSeeds().map(sampleSituation) };

describe("parseLifeReport", () => {
  test("returns the cards of a valid report", () => {
    expect(parseLifeReport({ sections: valid })?.situations).toHaveLength(5);
  });

  test("a missing, damaged or outdated report counts as no report", () => {
    expect(parseLifeReport(null)).toBeNull();
    expect(parseLifeReport(undefined)).toBeNull();
    expect(parseLifeReport({ sections: {} })).toBeNull();
    expect(parseLifeReport({ sections: { ...valid, version: 2 } })).toBeNull();
    expect(parseLifeReport({ sections: { ...valid, situations: valid.situations.slice(0, 4) } })).toBeNull();
    expect(parseLifeReport({ sections: "мусор" })).toBeNull();
  });
});
```

В `apps/web/src/lib/report-view.test.ts` (импорты `lifeSeeds` из `@grani/content`, `sampleSituation` из `@grani/ai/testing`):

```ts
describe("life cards in the page view", () => {
  const LIFE = { version: 1, situations: lifeSeeds().map(sampleSituation) };

  test("the owner of the full report sees the cards", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("life", LIFE)], friendsCount: 0 });

    expect(view.life?.situations).toHaveLength(5);
  });

  test("without the full report a stored life report stays hidden", () => {
    const view = buildReportPageView({ owned: [], reports: [report("life", LIFE)], friendsCount: 0 });

    expect(view.life).toBeNull();
  });

  test("a damaged life report is ignored", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("life", { version: 2 })], friendsCount: 0 });

    expect(view.life).toBeNull();
  });

  test("waiting for the cards never keeps the page refreshing", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("full", FULL)], friendsCount: 0 });

    expect(view.life).toBeNull();
    expect(view.preparing).toBe(false);
  });
});
```

Run: `pnpm vitest run apps/web/src/lib/life-report.test.ts apps/web/src/lib/report-view.test.ts` — Expected: FAIL.

- [ ] **Step 2: Реализация**

`apps/web/src/lib/life-report.ts`:

```ts
import { parseSections, type LifeSections } from "@grani/ai";
import type { ReportRecord } from "@grani/db";

// Повреждённый или устаревший отчёт равен отсутствующему: страница покажет статичные сценарии, а не упадёт
export function parseLifeReport(report: Pick<ReportRecord, "sections"> | null | undefined): LifeSections | null {
  return report ? parseSections("life", report.sections) : null;
}
```

`apps/web/src/lib/report-view.ts`:

1. Импорты: `import type { …, LifeSections }` из `@grani/ai` (добавить в существующий `import { buildPersonalInput, fallbackSections, parseSections, type ChapterSections, type FullSections, type PersonalScores }` тип `type LifeSections`), `import { parseLifeReport } from "./life-report";`
2. В `ReportPageView` добавить поле `life: LifeSections | null;`
3. В `buildReportPageView` перед `return`:

```ts
  // Карточки открыты вместе с полным разбором; повреждённый отчёт равен отсутствующему. На «готовим» они не влияют
  const life = unlocked.has("life") ? parseLifeReport(byKind.get("life")) : null;
```

и в возвращаемый объект добавить `life,`.

- [ ] **Step 3: Починить фикстуры**

Run: `pnpm --filter @grani/web typecheck`. Для каждого объекта типа `ReportPageView`, на который укажет компилятор (в `PersonalEdition.test.tsx` это `baseView`, в `PersonalEdition.covers.test.tsx` соседний `view`), добавить `life: null`.

Run: `pnpm vitest run apps/web/src/lib apps/web/src/components/personality-atlas && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 4: Закоммитить**

```bash
git add apps/web/src/lib apps/web/src/components/personality-atlas
git commit -m "feat(web): expose the life cards in the report page view for the owner of the full report"
```

---

### Task 6: Сайт: постановка задачи (после оплаты и при открытии страницы)

**Files:**
- Create: `apps/web/src/server/life-cards.ts`, `apps/web/src/server/life-cards.test.ts`
- Modify: `apps/web/src/server/payments-service.ts`, `apps/web/src/server/payments-service.test.ts`, `apps/web/src/server/payments-deps.ts`

**Interfaces:**
- Consumes: `GenerateJob` с видом `life` (Task 3), `unlockedKinds`.
- Produces:
  - `lifeCardsEnabled(): boolean` (читает `LIFE_CARDS_V1`)
  - `requestLifeCards(deps: { enabled: boolean; enqueueGenerate: (job: GenerateJob) => Promise<void> }, p: { resultId: string; owned: readonly Product[]; hasLife: boolean }): Promise<boolean>`
  - `PaymentsDeps.lifeCards?: boolean`

- [ ] **Step 1: Падающие тесты**

`apps/web/src/server/life-cards.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { lifeCardsEnabled, requestLifeCards } from "./life-cards";

const enqueueGenerate = vi.fn().mockResolvedValue(undefined);
const ask = (p: Partial<{ enabled: boolean; owned: ("full" | "pair")[]; hasLife: boolean }> = {}) =>
  requestLifeCards({ enabled: p.enabled ?? true, enqueueGenerate }, { resultId: "r1", owned: p.owned ?? ["full"], hasLife: p.hasLife ?? false });

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LIFE_CARDS_V1;
});

describe("lifeCardsEnabled", () => {
  test("is on only when LIFE_CARDS_V1 is 1", () => {
    expect(lifeCardsEnabled()).toBe(false);
    process.env.LIFE_CARDS_V1 = "0";
    expect(lifeCardsEnabled()).toBe(false);
    process.env.LIFE_CARDS_V1 = "1";
    expect(lifeCardsEnabled()).toBe(true);
  });
});

describe("requestLifeCards", () => {
  test("queues the life job once for a paid owner whose cards are missing", async () => {
    expect(await ask()).toBe(true);
    expect(enqueueGenerate).toHaveBeenCalledTimes(1);
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "life", resultId: "r1" });
  });

  test("does nothing with the flag off, with ready cards or without the full report", async () => {
    expect(await ask({ enabled: false })).toBe(false);
    expect(await ask({ hasLife: true })).toBe(false);
    expect(await ask({ owned: ["pair"] })).toBe(false);
    expect(await ask({ owned: [] })).toBe(false);
    expect(enqueueGenerate).not.toHaveBeenCalled();
  });
});
```

В `apps/web/src/server/payments-service.test.ts` (в `describe` с `buyAndPay`, импорты `saveReport`, `getPurchaseView` там уже есть):

```ts
describe("life cards after payment", () => {
  test("a full purchase queues the life cards too when the flag is on", async () => {
    deps = { ...deps, lifeCards: true };

    await buyAndPay("full");

    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
    expect(enqueue).toHaveBeenCalledWith({ kind: "life", resultId: anna.resultId });
  });

  test("with the flag off no life job is queued: it would be finished as skipped and block the later one", async () => {
    await buyAndPay("full");

    expect(enqueue.mock.calls.map(([job]) => job.kind)).not.toContain("life");
  });

  test("a chapter purchase never queues the life cards", async () => {
    deps = { ...deps, lifeCards: true };
    await buyAndPay("full");
    enqueue.mockClear();

    await buyAndPay("chapter_money");

    expect(enqueue.mock.calls.map(([job]) => job.kind)).toEqual(["chapter_money"]);
  });

  test("the waiting page does not wait for the life cards and does not requeue them", async () => {
    deps = { ...deps, lifeCards: true };
    const purchase = await buyAndPay("full");
    enqueue.mockClear();

    const early = await getPurchaseView(deps, { purchaseId: purchase!.id, userId: anna.userId });
    expect(early?.ready).toBe(false);
    expect(enqueue.mock.calls.map(([job]) => job.kind)).toEqual(["full"]);

    await saveReport(db, { target: { resultId: anna.resultId }, kind: "full", sections: {}, source: "fallback" });
    enqueue.mockClear();

    const late = await getPurchaseView(deps, { purchaseId: purchase!.id, userId: anna.userId });
    expect(late?.ready).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run apps/web/src/server/life-cards.test.ts apps/web/src/server/payments-service.test.ts` — Expected: FAIL.

- [ ] **Step 2: Реализация**

`apps/web/src/server/life-cards.ts`:

```ts
import { unlockedKinds, type GenerateJob, type Product } from "@grani/core";

// Карточки «В жизни»: включать вместе с LIFE_CARDS_V1 у воркера (см. deploy/server-setup.md)
export const lifeCardsEnabled = () => process.env.LIFE_CARDS_V1 === "1";

export type LifeCardsDeps = { enabled: boolean; enqueueGenerate: (job: GenerateJob) => Promise<void> };

// Уже купившим карточки ставятся при открытии страницы разбора. Id задачи детерминирован (`generate:<resultId>:life`),
// поэтому повторные открытия не плодят дубли
export async function requestLifeCards(deps: LifeCardsDeps, p: { resultId: string; owned: readonly Product[]; hasLife: boolean }): Promise<boolean> {
  if (!deps.enabled || p.hasLife || !unlockedKinds(p.owned).has("life")) return false;
  await deps.enqueueGenerate({ kind: "life", resultId: p.resultId });
  return true;
}
```

`apps/web/src/server/payments-service.ts`:

1. В `PaymentsDeps` добавить:

```ts
  // Карточки «В жизни» ставятся вместе с полным разбором только при включённом флаге: задача, завершённая как «пропущено», заняла бы id
  lifeCards?: boolean;
```

2. В `enqueuePaid` заменить блок с `friends`:

```ts
  const jobs = jobsFor(purchase.product, target);
  if ("resultId" in target && purchase.product === "full") {
    if (friendsReportDue(["full"], await friendsCount(deps.db, target.resultId))) jobs.push({ kind: "friends", resultId: target.resultId });
    // Карточек нет в jobsFor: страница оплаты не должна ждать отчёт, у которого есть запасной вариант
    if (deps.lifeCards === true) jobs.push({ kind: "life", resultId: target.resultId });
  }
```

`apps/web/src/server/payments-deps.ts`: импорт `import { lifeCardsEnabled } from "./life-cards";`, в возвращаемый объект добавить `lifeCards: lifeCardsEnabled(),`.

Run: `pnpm vitest run apps/web/src/server && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 3: Закоммитить**

```bash
git add apps/web/src/server
git commit -m "feat(web): queue the life cards after the full report is paid and on first open"
```

---

### Task 7: Сайт: вкладка «В жизни» карточками

**Files:**
- Create: `apps/web/src/components/SituationCard.tsx`, `apps/web/src/components/LifeCards.tsx`, `apps/web/src/components/LifeCards.test.tsx`
- Modify: `apps/web/src/components/ChapterCards.tsx`
- Modify: `apps/web/src/lib/chapter-cover.ts`, `apps/web/src/lib/chapter-cover.test.ts`
- Modify: `apps/web/src/components/personality-atlas/PersonalEdition.tsx`, `PersonalEdition.test.tsx`
- Modify: `apps/web/src/app/report/[resultId]/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `ReportPageView.life` (Task 5), `requestLifeCards`, `lifeCardsEnabled` (Task 6), `Situation`, `LifeSections` (Task 2).
- Produces: `lifeIconPath(seed: string): string | null` и `LIFE_ICON_SEEDS: readonly string[]`; `<SituationCard card index iconSrc />`; `<LifeCards sections />`.

- [ ] **Step 1: Значки: падающий тест**

В `apps/web/src/lib/chapter-cover.test.ts` (импорт `lifeSeeds` из `@grani/content`, `lifeIconPath`, `LIFE_ICON_SEEDS` из `./chapter-cover`):

```ts
describe("lifeIconPath", () => {
  test("gives no path for unknown themes", () => {
    expect(lifeIconPath("unknown")).toBeNull();
    expect(lifeIconPath("help")).toBeNull();
  });

  test("every listed life icon belongs to a life theme and has a file in the public folder", () => {
    const LIFE_PUBLIC = new URL("../../public/life/", import.meta.url);

    for (const seed of LIFE_ICON_SEEDS) {
      expect(lifeSeeds().map((theme) => theme.id)).toContain(seed);
      expect(lifeIconPath(seed)).toBe(`/life/${seed}.webp`);
      expect(existsSync(new URL(`${seed}.webp`, LIFE_PUBLIC)), `life/${seed}.webp`).toBe(true);
    }
  });
});
```

Run: `pnpm vitest run apps/web/src/lib/chapter-cover.test.ts` — Expected: FAIL.

- [ ] **Step 2: Реализация значков**

В `apps/web/src/lib/chapter-cover.ts` дописать:

```ts
// Значки тем «В жизни» (public/life/<тема>.webp). Список пополняется отдельным небольшим PR, когда файлы нарисованы и лежат в папке;
// пока он пуст, карточки показываются без значков
export const LIFE_ICON_SEEDS: readonly string[] = [];

export function lifeIconPath(seed: string): string | null {
  return LIFE_ICON_SEEDS.includes(seed) ? `/life/${seed}.webp` : null;
}
```

Run: `pnpm vitest run apps/web/src/lib/chapter-cover.test.ts` — Expected: PASS.

- [ ] **Step 3: Карточка ситуации: общий компонент (рефакторинг под защитой тестов глав)**

Run (до правки): `pnpm vitest run apps/web/src/components/ChapterCards.test.tsx` — Expected: PASS.

Создать `apps/web/src/components/SituationCard.tsx` (разметка один в один из `ChapterCards.tsx`, строки 41–64):

```tsx
import type { Situation } from "@grani/ai";
import Image from "next/image";
import { EDITION_TRAITS } from "@/lib/personal-edition-copy";
import styles from "./ChapterCards.module.css";

// Одна карточка ситуации: общая для глав и для вкладки «В жизни»
export function SituationCard({ card, index, iconSrc }: { card: Situation; index: number; iconSrc: string | null }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
        {iconSrc && <Image className={styles.icon} src={iconSrc} alt="" width={80} height={80} />}
      </div>
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
  );
}
```

В `ChapterCards.tsx` заменить тело `<li key={card.seed}>…</li>` на:

```tsx
          <li key={card.seed}>
            <SituationCard card={card} index={index} iconSrc={seedIconPath(kind, card.seed)} />
          </li>
```

и поправить импорты: добавить `import { SituationCard } from "./SituationCard";`, убрать более не нужные `Image` (если больше не используется в файле) и `EDITION_TRAITS`.

Run: `pnpm vitest run apps/web/src/components/ChapterCards.test.tsx` — Expected: PASS без изменений тестов.

- [ ] **Step 4: `LifeCards`: падающий тест**

`apps/web/src/components/LifeCards.test.tsx`:

```tsx
import { parseLifeCards } from "@grani/ai";
import { sampleSituation } from "@grani/ai/testing";
import { lifeSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LifeCards } from "./LifeCards";

const sections = () => {
  const built = parseLifeCards({ version: 1, situations: lifeSeeds().map(sampleSituation) });
  if (!built) throw new Error("fixture is not valid life cards");
  return built;
};

describe("LifeCards", () => {
  test("shows the heading, five numbered cards with every part and no chapter-only blocks", () => {
    const html = renderToStaticMarkup(<LifeCards sections={sections()} />);

    expect(html).toContain("data-life-cards");
    expect(html).toContain("Когда жизнь меняет условия");
    expect(html.match(/<article/g)).toHaveLength(5);
    for (const label of ["Узнаёшь себя?", "Почему так", "Что сказать", "Что сделать"]) expect(html.match(new RegExp(label.replace("?", "\\?"), "g"))).toHaveLength(5);
    for (const number of ["01", "02", "03", "04", "05"]) expect(html).toContain(`>${number}</p>`);
    expect(html).not.toContain("Три ловушки");
    expect(html).not.toContain("Как это видят близкие");
  });

  test("shows the card texts and no icons while the icon files are not listed", () => {
    const html = renderToStaticMarkup(<LifeCards sections={sections()} />);

    expect(html).toContain("Ситуация: Планы внезапно изменились");
    expect(html).toContain("«Мне нужно время подумать, отвечу завтра.»");
    expect(html).not.toContain("<img");
  });
});
```

Run: `pnpm vitest run apps/web/src/components/LifeCards.test.tsx` — Expected: FAIL.

- [ ] **Step 5: `LifeCards`: реализация**

`apps/web/src/components/LifeCards.tsx`:

```tsx
import type { LifeSections } from "@grani/ai";
import { lifeIconPath } from "@/lib/chapter-cover";
import { SituationCard } from "./SituationCard";
import styles from "./ChapterCards.module.css";

// Вкладка «В жизни»: пять карточек, написанных под баллы читателя; вёрстка карточек общая с главами
export function LifeCards({ sections }: { sections: LifeSections }) {
  return (
    <section className={styles.root} data-life-cards aria-labelledby="life-cards-title">
      <header className={styles.head}>
        <p className={styles.label}>Мои жизненные сценарии</p>
        <h3 id="life-cards-title">Когда жизнь меняет условия</h3>
        <p>Пять ситуаций, чтобы заметить привычную реакцию и попробовать другой ход. Это вопросы к наблюдению, а не прогноз по баллам.</p>
      </header>
      <ol className={styles.cards}>
        {sections.situations.map((card, index) => (
          <li key={card.seed}>
            <SituationCard card={card} index={index} iconSrc={lifeIconPath(card.seed)} />
          </li>
        ))}
      </ol>
    </section>
  );
}
```

Run: `pnpm vitest run apps/web/src/components/LifeCards.test.tsx` — Expected: PASS.

- [ ] **Step 6: Вкладка: падающий тест**

В `apps/web/src/components/personality-atlas/PersonalEdition.test.tsx` (импорты `parseLifeCards` из `@grani/ai`, `sampleSituation` из `@grani/ai/testing`, `lifeSeeds` из `@grani/content`):

```tsx
  test("the life tab shows the model's cards when they are ready and the static scenarios otherwise", () => {
    const life=parseLifeCards({version:1,situations:lifeSeeds().map(sampleSituation)})!;
    const withCards=renderToStaticMarkup(<PersonalEdition {...props} view={{...baseView,life}}/>);
    expect(withCards).toContain("data-life-cards");
    expect(withCards).toContain("Ситуация: Планы внезапно изменились");
    expect(withCards).not.toContain("Пять жизненных ситуаций");
    const without=renderToStaticMarkup(<PersonalEdition {...props}/>);
    expect(without).not.toContain("data-life-cards");
    expect(without).toContain("Пять жизненных ситуаций");
  });
```

Run: `pnpm vitest run apps/web/src/components/personality-atlas/PersonalEdition.test.tsx` — Expected: FAIL.

- [ ] **Step 7: Вкладка: реализация**

В `PersonalEdition.tsx`: импорт `import { LifeCards } from "@/components/LifeCards";`; в разметке вкладки `edition-life` заменить `<AtlasScenarios model={model}/>` на

```tsx
{view.life?<LifeCards sections={view.life}/>:<AtlasScenarios model={model}/>}
```

Run: `pnpm vitest run apps/web/src/components/personality-atlas` — Expected: PASS.

- [ ] **Step 8: Страница: ленивая постановка, падающий тест**

В `apps/web/src/app/report/[resultId]/page.test.tsx`:

1. В `vi.hoisted` добавить `enqueue:vi.fn()`; добавить `vi.mock("@/server/queue",()=>({enqueueGenerate:mocks.enqueue}));` (рядом с другими `vi.mock`).
2. В `beforeEach`: добавить `delete process.env.LIFE_CARDS_V1;` и в `mocks.view.mockReturnValue({...})` поле `life:null`.
3. Добавить тесты:

```tsx
test("an existing buyer without cards gets the job queued once when the flag is on",async()=>{process.env.PERSONALITY_ATLAS_V2="1";process.env.LIFE_CARDS_V1="1";await render();expect(mocks.enqueue).toHaveBeenCalledTimes(1);expect(mocks.enqueue).toHaveBeenCalledWith({kind:"life",resultId:"r"});});
test("nothing is queued with the flag off, with ready cards, on the old page or for an unpaid result",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";await render();
  process.env.LIFE_CARDS_V1="1";const cards={version:1,situations:lifeSeeds().map(sampleSituation)};
  mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:cards});await render();
  delete process.env.PERSONALITY_ATLAS_V2;mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:null});await render();
  process.env.PERSONALITY_ATLAS_V2="1";mocks.products.mockResolvedValueOnce([]);await expect(render()).rejects.toThrow("redirect");
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
```

(импорты `lifeSeeds` из `@grani/content` расширить в существующей строке `import { chapterSeeds } from "@grani/content";`).

Run: `pnpm vitest run "apps/web/src/app/report/[resultId]/page.test.tsx"` — Expected: FAIL (задача не ставится).

- [ ] **Step 9: Страница: реализация**

В `apps/web/src/app/report/[resultId]/page.tsx`: импорты

```tsx
import { lifeCardsEnabled, requestLifeCards } from "@/server/life-cards";
import { enqueueGenerate } from "@/server/queue";
```

и сразу после строки `const model = …;` (где определяется `model`):

```tsx
  // Уже купившим карточки «В жизни» ставятся при открытии страницы; пока их нет, вкладка показывает статичные сценарии
  if (model) await requestLifeCards({ enabled: lifeCardsEnabled(), enqueueGenerate }, { resultId, owned, hasLife: view.life !== null });
```

Run: `pnpm vitest run "apps/web/src/app/report/[resultId]/page.test.tsx" && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 10: Посмотреть глазами**

Запустить локально (`pnpm dev:db`, затем `PERSONALITY_ATLAS_V2=1 MONEY_PRACTICE_V1=1 CHAPTER_CARDS_V2=1 LIFE_CARDS_V1=1 pnpm dev:web` через `preview_start`), войти как `/api/dev/login?name=Paid`, открыть результат `64da99f5-c74c-4c3d-94e5-44de1be990f9`, вкладку «В жизни». ИИ локально выключен, поэтому карточек нет: положить тестовый отчёт `life` прямо в локальную БД (скрипт в `scratchpad`, данные из `sampleSituation`) и обновить страницу. Проверить: десктоп 1280 (две колонки), телефон 390 (одна колонка), блоки «По желанию…» ниже на месте, консоль без ошибок. Если контраст или отступы выбиваются из соседних вкладок, поправить CSS-модуль минимально и приложить снимки в PR.

- [ ] **Step 11: Закоммитить**

```bash
git add apps/web
git commit -m "feat(web): the life tab shows the model's cards, static scenarios stay as the fallback"
```

---

### Task 8: Памятка: эпиграф и «Что хочу попробовать» из карточек

**Files:**
- Modify: `apps/web/src/lib/personality-atlas.ts`, `apps/web/src/lib/personality-atlas.test.ts`
- Modify: `apps/web/src/server/personality-atlas-service.ts`, `personality-atlas-service.test.ts`
- Modify: `apps/web/src/server/personality-atlas-pdf/source.ts`, `source.test.ts`
- Modify: `apps/web/src/app/report/[resultId]/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `LifeSections`, `parseLifeReport`, `ReportPageView.life`.
- Produces: `initialAtlasData(model: PersonalityAtlas, life?: LifeSections | null): AtlasDraftData`: при наличии карточек `memo.quote` = первая фраза «Что сказать» первой карточки, `memo.items[4]` («Что хочу попробовать») = «Что сделать» первой карточки; остальное как раньше.

- [ ] **Step 1: Нейтральный эпиграф без пустой фразы: падающий тест**

В `apps/web/src/lib/personality-atlas.test.ts` (импорт `styleProblems` из `@grani/ai`):

```ts
  test("no profile gets an empty phrase as the memo epigraph", () => {
    const profiles = [
      { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 },
      { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 },
      { openness: 10, conscientiousness: 90, extraversion: 20, agreeableness: 80, stability: 70 },
      SOFIA,
    ];

    for (const scores of profiles) {
      const quote = buildPersonalityAtlas(scores).memo.quote;
      expect(styleProblems([quote], 1), quote).toEqual([]);
      expect(quote).not.toContain("конкретной ситуации");
    }
  });
```

Run: `pnpm vitest run apps/web/src/lib/personality-atlas.test.ts` — Expected: FAIL.

- [ ] **Step 2: Реализация эпиграфа** **[на утверждение: текст]**

В `apps/web/src/lib/personality-atlas.ts` перед `buildPersonalityAtlas` добавить

```ts
// Запасной эпиграф памятки, пока нет карточек «В жизни»: без пустых фраз вроде «в моей конкретной ситуации»
const NEUTRAL_MEMO_QUOTE = "Свою привычную реакцию я могу проверить на одной знакомой ситуации.";
```

и в `memo.quote` заменить строку `"Полезный подход — тот, который помогает в моей конкретной ситуации."` на `NEUTRAL_MEMO_QUOTE`.

Run: `pnpm vitest run apps/web/src/lib/personality-atlas.test.ts` — Expected: PASS.

- [ ] **Step 3: Сервис: падающие тесты**

В `apps/web/src/server/personality-atlas-service.test.ts` (импорты: `lifeSeeds` из `@grani/content`, `sampleSituation` из `@grani/ai/testing`, `parseLifeCards` из `@grani/ai`, `saveReport` из `@grani/db/testing`):

```ts
describe("memo from the life cards",()=>{
  const life=()=>parseLifeCards({version:1,situations:lifeSeeds().map(sampleSituation)})!;
  const model=()=>buildPersonalityAtlas(SOFIA);

  test("the epigraph and the 'what to try' line come from the first card, the rest is unchanged",()=>{
    const plain=initialAtlasData(model()),withCards=initialAtlasData(model(),life());
    expect(withCards.memo.quote).toBe(life().situations[0]!.say[0]);
    expect(withCards.memo.items[4]).toBe(life().situations[0]!.do);
    expect(withCards.memo.items.slice(0,4)).toEqual(plain.memo.items.slice(0,4));
    expect(withCards.interaction).toEqual(plain.interaction);
    expect(initialAtlasData(model(),null)).toEqual(plain);
  });

  test("a new memo is built from the stored cards, a saved memo is never touched",async()=>{
    const buyer=await seedUserWithResult(db,{externalId:"atlas-life",scores:SOFIA});
    await db.insert(purchases).values({userId:buyer.userId,resultId:buyer.resultId,product:"full",amountKopecks:29900,status:"succeeded",paidAt:new Date()});
    await saveReport(db,{target:{resultId:buyer.resultId},kind:"life",sections:life(),source:"ai"});

    const before=await readPersonalAtlas(db,buyer);
    expect(before).toMatchObject({ok:true,draft:{revision:0,data:{memo:{quote:life().situations[0]!.say[0]}}}});

    const mine=initialAtlasData(model());mine.memo.quote="Моя фраза";
    await savePersonalAtlas(db,{...buyer,expectedRevision:0,data:mine});
    const after=await readPersonalAtlas(db,buyer);
    expect(after).toMatchObject({ok:true,draft:{revision:1,data:{memo:{quote:"Моя фраза"}}}});
    if(after.ok)expect(after.draft.data.memo.items[4]).toBe(mine.memo.items[4]);
  });

  test("a damaged life report gives the usual memo",async()=>{
    const broken=await seedUserWithResult(db,{externalId:"atlas-life-broken",scores:SOFIA});
    await db.insert(purchases).values({userId:broken.userId,resultId:broken.resultId,product:"full",amountKopecks:29900,status:"succeeded",paidAt:new Date()});
    await saveReport(db,{target:{resultId:broken.resultId},kind:"life",sections:{version:2},source:"ai"});

    const result=await readPersonalAtlas(db,broken);
    expect(result).toMatchObject({ok:true,draft:{data:{memo:{quote:fresh().memo.quote}}}});
  });
});
```

Run: `pnpm vitest run apps/web/src/server/personality-atlas-service.test.ts` — Expected: FAIL.

- [ ] **Step 4: Сервис: реализация**

`apps/web/src/server/personality-atlas-service.ts`:

1. Импорты: `import type { LifeSections } from "@grani/ai";`, `getReport` в импорт из `@grani/db`, `import { parseLifeReport } from "@/lib/life-report";`
2. Заменить `initialAtlasData`:

```ts
// Пункт памятки «Что хочу попробовать» — пятый
const MEMO_TRY_ITEM = 4;
// Карточки «В жизни» дают эпиграф и «Что хочу попробовать» только памятке, которой ещё нет в базе: сохранённую читаем как есть
export function initialAtlasData(model:PersonalityAtlas,life:LifeSections|null=null):AtlasDraftData{
  const first=life?.situations[0],items=model.memo.items.map(i=>i.text);
  if(first)items[MEMO_TRY_ITEM]=first.do;
  return {done:Array(7).fill(false),notes:Array(7).fill(""),decision:"",interaction:[...model.interaction],memo:{quote:first?first.say[0]!:model.memo.quote,items}};
}
```

3. В `readPersonalAtlas`:

```ts
export async function readPersonalAtlas(db:Database,p:{userId:string;resultId:string}):Promise<AtlasResponse>{
  const allowed=await access(db,p);if(!allowed.ok)return allowed;
  const stored=await loadAtlasDraft(db,p.resultId);
  if(stored)return {ok:true,draft:stored};
  const life=parseLifeReport(await getReport(db,{resultId:p.resultId},"life"));
  return {ok:true,draft:{revision:0,updatedAt:null,data:initialAtlasData(buildPersonalityAtlas(allowed.result.scores),life)}};
}
```

Run: `pnpm vitest run apps/web/src/server/personality-atlas-service.test.ts` — Expected: PASS.

- [ ] **Step 5: PDF: падающий тест**

В `apps/web/src/server/personality-atlas-pdf/source.test.ts`:

```ts
test("an unsaved memo is exported with the life card epigraph, a saved memo keeps its own text",async()=>{
 const life=parseLifeCards({version:1,situations:lifeSeeds().map(sampleSituation)})!;
 vi.mocked(buildReportPageView).mockReturnValue({full:{},life} as never);
 const fresh=await loadAtlasMemoPdfSource({} as never,actor);
 if("error" in fresh)throw Error("Expected PDF source");expect(fresh.memo.quote).toBe(life.situations[0]!.say[0]);
 const data=initialAtlasData(buildPersonalityAtlas(scores));data.memo.quote="Моя сохранённая фраза";
 vi.mocked(loadAtlasDraft).mockResolvedValue({revision:2,data,updatedAt:new Date()});
 const saved=await loadAtlasMemoPdfSource({} as never,{...actor,expectedRevision:2});
 if("error" in saved)throw Error("Expected PDF source");expect(saved.memo.quote).toBe("Моя сохранённая фраза");
});
```

(добавить импорты `parseLifeCards` из `@grani/ai`, `sampleSituation` из `@grani/ai/testing`, `lifeSeeds` из `@grani/content`).

Run: `pnpm vitest run apps/web/src/server/personality-atlas-pdf/source.test.ts` — Expected: FAIL.

- [ ] **Step 6: PDF: реализация**

В `source.ts` заменить `initialAtlasData(model)` на `initialAtlasData(model,view.life ?? null)`. (`?? null`, потому что тест подставляет частичное представление.)

Run: `pnpm vitest run apps/web/src/server/personality-atlas-pdf` — Expected: PASS.

- [ ] **Step 7: Страница: падающий тест**

В `page.test.tsx`:

```tsx
test("the epigraph comes from the first life card, and a saved memo keeps its own text",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";
  const cards={version:1,situations:lifeSeeds().map(sampleSituation)};
  mocks.view.mockReturnValue({full,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null,life:cards});
  expect(await render()).toMatch(/<span>Личный ориентир<\/span><p>Мне нужно время подумать, отвечу завтра\./);

  const saved=initialAtlasData(buildPersonalityAtlas({openness:85,conscientiousness:90,extraversion:25,agreeableness:35,stability:65}));saved.memo.quote="Моя сохранённая фраза";
  mocks.load.mockResolvedValue({revision:4,data:saved,updatedAt:new Date()});
  const html=await render();
  expect(html).toMatch(/<span>Личный ориентир<\/span><p>Моя сохранённая фраза/);
  expect(html).not.toMatch(/<span>Личный ориентир<\/span><p>Мне нужно время/);
});
```

(импорты `initialAtlasData` из `@/server/personality-atlas-service`, `buildPersonalityAtlas` из `@/lib/personality-atlas`).

Run: `pnpm vitest run "apps/web/src/app/report/[resultId]/page.test.tsx"` — Expected: FAIL.

- [ ] **Step 8: Страница: реализация**

В `page.tsx` заменить `initialAtlasData(model)` на `initialAtlasData(model, view.life)`.

Run: `pnpm vitest run apps/web && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 9: Закоммитить**

```bash
git add apps/web
git commit -m "feat(web): a new memo takes its epigraph and next experiment from the life cards"
```

---

### Task 9: Задание на значки, конфигурация, инструкция по выкладке

**Files:**
- Create: `docs/redesign/GPT_LIFE_ICONS.md`
- Modify: `deploy/env.example`, `deploy/server-setup.md`

- [ ] **Step 1: Задание для GPT**

`docs/redesign/GPT_LIFE_ICONS.md`:

````markdown
# Задание для GPT: значки пяти ситуаций «В жизни»

Вкладка «В жизни» выводится карточками, как главы. У каждой из пяти ситуаций нужен значок: итого **5 файлов**. Тексты и вёрстку делает Claude, от вас только изображения. Пока файлов нет, карточки показываются без значков.

Образцы стиля: готовые значки глав (`apps/web/public/chapters/*/*.webp`). Нужен тот же характер: один золотой предмет, мягкий блик, фотореализм, прозрачный фон.

## Требования

1. Размер **480×480**, WebP с **альфа-каналом**, вес до **40 КБ** на файл.
2. **Один предмет** по центру, запас по краям около 12%. Значок показывают размером 64–96 px, поэтому без искр, осколков, россыпи частиц и отражений на поверхности.
3. **Чистая вырезка:** ровный контур, без остатков тёмного фона и ореола. Проверять на светлом фоне (`#F1ECDF`) и на тёмном (`#102A21`).
4. Палитра: золото `#D4B878`, у камней и вставок глубокий изумруд, мягкий тёплый блик. Без текста, цифр, людей, рук и лиц.
5. Не рисовать обручальные кольца, сердца с узорами из бриллиантов и любые образы свадьбы.
6. Предметы должны заметно отличаться по силуэту: на странице они стоят рядом. Не повторять предметы глав (лупа, зеркало, песочные часы, будильник, ключ, якорь).

## Ситуации (`apps/web/public/life/`)

| Ситуация (id) | Файл | Что показать |
|---|---|---|
| Планы внезапно изменились (`change`) | `change.webp` | Золотой флюгер-стрелка на тонком стержне |
| Твою идею раскритиковали (`critique`) | `critique.webp` | Золотой карандаш с изумрудным ластиком |
| Срок подходит, работа не закончена (`deadline`) | `deadline.webp` | Золотой отрывной календарь с одним загнутым листом |
| Предстоит непростой разговор (`talk`) | `talk.webp` | Золотой чайник с изумрудной ручкой |
| Коллега предлагает другой способ (`method`) | `method.webp` | Золотой раскрытый циркуль |

## Проверка перед сдачей

- 5 файлов, имена точно как в таблице, размеры и вес в пределах.
- На светлом и на тёмном фоне нет пятен и ореола.
- Силуэты различимы в уменьшении до 64 px.
- Нет колец-«обручалок» и свадебных образов.

## Куда класть и что дальше

Файлы кладутся в `apps/web/public/life/`. После получения Claude подключит их одной небольшой правкой: список `LIFE_ICON_SEEDS` в `apps/web/src/lib/chapter-cover.ts` (тест проверит, что каждый значок лежит в папке).
````

- [ ] **Step 2: Конфигурация и инструкция**

`deploy/env.example`, после строки `#CHAPTER_CARDS_V2=1`:

```
# Карточки «В жизни» в платном разборе и живая памятка. Включать вместе с ИИ (yandex/gigachat); у сайта и воркера значение одно
#LIFE_CARDS_V1=1
```

`deploy/server-setup.md`, после абзаца «Пилот «Деньги карточками»»:

```markdown
**Карточки «В жизни».** `LIFE_CARDS_V1=1` в `.env`, затем `docker compose up -d web worker`: флаг читают оба контейнера, включать нужно сразу оба. В строке `worker started` должно быть `lifeCardsV1: true`. Проверка: открыть разбор тестового аккаунта, через минуту обновить страницу, во вкладке «В жизни» должны быть пять карточек; в логе `docker logs --since 10m grani-worker-1 | grep -iE "chapter part|life|report generated"`: `report generated` с `kind: life` и `source: ai`. Если в логе `life cards failed`, отчёт не сохранён и на странице остаются прежние сценарии; повторить можно, удалив завершённую задачу из `pgboss.job` (id `generate:<resultId>:life`). Откат: убрать переменную и пересоздать `web` и `worker`: уже созданные карточки продолжат показываться.
```

- [ ] **Step 3: Закоммитить**

```bash
git add docs/redesign/GPT_LIFE_ICONS.md deploy/env.example deploy/server-setup.md
git commit -m "docs: life icons brief and the rollout steps for LIFE_CARDS_V1"
```

---

### Task 10: Финальная проверка и PR

- [ ] **Step 1: Полные проверки**

Run: `pnpm test` и `pnpm typecheck`.
Expected: всё зелёное. Если `practice-upgrade` или `personality-atlas-upgrade` упали по таймауту, запустить их отдельно (`pnpm vitest run packages/db/src/practice-upgrade.test.ts`, затем `pnpm vitest run packages/db/src/personality-atlas-upgrade.test.ts`) и считать ошибкой только повторное падение.

- [ ] **Step 2: Один разбор всей ветки самим собой**

Прочитать `git diff feat/personal-report-life-cards...` целиком по чек-листу: Global Constraints и Review Focus этого плана; в `grep -rn "Record<ReportKind\|REPORT_KINDS" apps packages e2e` нет мест, где `life` случайно попал в списки продуктов, цен, рассылок; нет `console.log`; нет текстов ответа модели в логах; функции короче 50 строк. Найденное исправить отдельными коммитами.

- [ ] **Step 3: Открыть PR (слияние не делать)**

```bash
git push -u origin feat/personal-report-life-cards
gh pr create --base master --title "feat: life cards and a living memo in the personal report" --body-file <файл с описанием>
```

В описании: что сделано (по задачам), как включать (`LIFE_CARDS_V1`), снимки вкладки (десктоп и телефон), и честный раздел **«Не проверено»**: живая генерация YandexGPT (локально ИИ выключен); миграция на боевой БД (проверена только на PGlite); пять значков (рисует GPT, подключаются отдельным PR); утверждение владельцем нейтрального эпиграфа «Свою привычную реакцию я могу проверить на одной знакомой ситуации.» и вводного текста вкладки. Затем по правилам приложения: `get_status`, при необходимости `bind_pr`, прочитать проверки CI.

- [ ] **Step 4: Ждать команды «вливай»**

В `master` не вливать. После команды: дождаться зелёных проверок PR, влить, дождаться зелёного `deploy`. Дальше выкладка по `deploy/server-setup.md` (включение флага и проверка) делается владельцем по готовым однострочным командам, по одной.

---

## Выкладка (для владельца, после слияния)

1. Выкатка кода с выключенным флагом: поведение не меняется (миграция только добавляет значение в enum).
2. Включить `LIFE_CARDS_V1=1` в `.env` на сервере и пересоздать `web` и `worker` одной командой (см. `deploy/server-setup.md`).
3. Открыть разбор тестового аккаунта, подождать минуту, обновить страницу, посмотреть вкладки «В жизни» и «Мой итог», затем лог воркера.
4. Откат: убрать переменную и пересоздать контейнеры.

## Самопроверка плана

**Покрытие спецификации**

| Требование спецификации | Задача |
|---|---|
| `life` в `REPORT_KINDS`, доступ как у `full`, не продукт | 3, 6 |
| enum `report_kind` + аддитивная миграция отдельным коммитом | 3 |
| Формат `{ version: 1, situations: [5] }`, схема карточки та же | 2 |
| Пять тем, названия и черты | 1 |
| Два запроса 3+2, правила как у глав, пять попыток, замечания, мягкая последняя | 2 |
| Блоки библиотеки по пяти чертам, без имён во входе | 2 (`blocksOf`, `buildChapterPartPrompt`) |
| Нет ИИ / все попытки провалены → отчёт не сохраняется | 4 |
| Флаг `LIFE_CARDS_V1` по умолчанию выключен | 4, 6, 9 |
| Новым покупателям задача сразу после оплаты | 6 |
| Уже купившим при открытии страницы, идемпотентно | 6, 7 |
| Вкладка: карточки или статика, иконки по `seed`, двухколоночная сетка | 7 |
| Памятка: эпиграф и «Что хочу попробовать» из карточек, сохранённая не меняется, без пустой фразы | 8 |
| Список исключений (письма, «4 сферы», цены, покупки) закреплён тестами | 3, 5, 6 |
| Задание на значки | 9 |
| Лог без текстов ответа | 2, 4 |

**Сканирование на пустые места:** шагов «позже» и «подобрать по месту» нет; единственное намеренно открытое решение: тексты, помеченные **[на утверждение]** (нейтральный эпиграф в Task 8, вводный абзац карточек в Task 7 повторяет уже утверждённый текст вкладки), владелец подтверждает в PR.

**Согласованность имён:** `CardsKind`, `cardSeeds`, `cardsTitle`, `cardsSections`, `lifeSeeds` (Task 1) → используются в Task 2 как есть; `LifeCardsSchema`, `LifeSections`, `parseLifeCards`, `Situation` (Task 2) → `parseSections("life")` (Task 3) → `parseLifeReport`, `ReportPageView.life` (Task 5) → `LifeCards`, `initialAtlasData(model, life)` (Tasks 7–8); `lifeCardsEnabled`, `requestLifeCards`, `PaymentsDeps.lifeCards` (Task 6) → страница (Task 7); `GenerateDeps.lifeCardsV1` ↔ `WorkerEnv.lifeCardsV1` (Task 4).
