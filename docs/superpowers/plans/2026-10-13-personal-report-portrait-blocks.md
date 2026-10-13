# «Портрет» короткими блоками без повторов бесплатного результата: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка «Портрет» платного разбора показывает фразу-вывод и пять коротких блоков, написанных ИИ под баллы человека и не пересказывающих бесплатный результат, вместо абзаца, карты шкал и «Ваших сильных сторон».

**Architecture:** Новый вид отчёта `portrait` по образцу `life`: открывается с оплаченным `full`, пишется воркером одним запросом по правилам карточек (схема, стоп-слова, стиль, род, замечания модели, пять попыток, мягкая последняя попытка) плюс проверка на пересказ бесплатных текстов. Механизм «дополнительных отчётов» (`life`, `portrait`) обобщается: общий список `EXTRA_KINDS` в ядре, общая постановка задач на сайте и общий запуск в воркере. Без ИИ или при неудаче отчёт не сохраняется, вкладка остаётся прежней.

**Tech Stack:** TypeScript, zod 4, vitest 5, Next.js (apps/web), pg-boss (apps/worker), Drizzle + PGlite, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-13-personal-report-portrait-blocks-design.md`. Образец реализации: шаг 1, `docs/superpowers/plans/2026-10-13-personal-report-life-cards.md` (влит в PR 143 и 145).

## Global Constraints

- Тексты для пользователей: русский, на «ты», нейтральный род, без утверждений о прошлом читателя, без диагнозов, без пустых фраз. Новых видимых текстов в интерфейсе нет, кроме пяти заголовков блоков (утверждены владельцем).
- `portrait` не продукт: не в `PRODUCTS`, цены, `jobsFor`, письма «Готово», «4 сферы». Открывается с `full` через `unlockedKinds`.
- Формат `sections`: `{ version: 1, headline (40–140 знаков), blocks: [5 × { seed, title, text (150–350 знаков) }] }`; `title` подставляет код из тем, модель его не пишет.
- Пять тем (`seed`, заголовок, черты, разделы библиотеки): `start` «Как ты берёшься за дело» (openness, conscientiousness; work); `talk` «Как ты общаешься» (extraversion, agreeableness; relationships); `load` «Что происходит под нагрузкой» (stability; stress); `energy` «Что даёт тебе энергию» (extraversion, openness; work, relationships); `support` «На что в тебе можно опереться» (agreeableness, conscientiousness; relationships, work).
- Генерация: один запрос, пять попыток (`CARD_ATTEMPTS`), замечания модели при повторе, мягкая последняя попытка с пометкой `forgiven`; проверка на пересказ: блок не повторяет (`repeatsAny`) короткий и длинный тексты типа, текст про устойчивость, блоки `strengths` по чертам, блоки входа и соседние блоки. В лог не попадают тексты ответа.
- Флаг `PORTRAIT_V1=1` у воркера и сайта, по умолчанию выключен. Сайт ставит задачу только при включённом собственном флаге.
- Запасного текста нет: нет ИИ или исчерпаны попытки → отчёт не сохраняется.
- Отчёт `full` и поле `portrait` в нём не меняются и не переписываются.
- Миграция enum отдельным коммитом. Каждое изменение: тест сначала (увидеть падение), потом код; перед PR полный `pnpm test` и `pnpm typecheck`. Тесты миграций БД при падении по таймауту запускать отдельно.
- В `master` не вливать без явной команды «вливай». PR с честным разделом «Не проверено».
- Windows + Git Bash: строки с `\n` в тестах и коде править инструментом правки, не скриптами со вставкой через heredoc (обратная косая черта теряется).

## Review Focus

1. **Повреждённый или устаревший JSON `portrait`** (версия 2, четыре блока, мусор): вкладка показывает нынешний вид, а не падает (Task 5).
2. **Задача `portrait` при выключенном флаге воркера** заняла бы id: сайт ставит только при своём флаге, воркер при выключенном ничего не пишет (Task 4, Task 6).
3. **Страница оплаты** не ждёт `portrait` (Task 6).
4. **Пересказ бесплатного текста:** блок с повтором отклоняется, на последней попытке принимается с `forgiven` (Task 3).
5. **`portrait` не просачивается:** без оплаченного `full` не виден, уведомление «Готово» не уходит, в `jobsFor` и «4 сферы» нет (Task 2, Task 4, Task 5).

---

## Карта файлов

**Создать**
- `packages/content/src/portrait-seeds.ts`, `portrait-seeds.test.ts`: пять тем.
- `packages/ai/src/portrait-cards.ts`, `portrait-cards.test.ts`: запрос, проверка, сборка.
- `packages/ai/src/generate-portrait.ts`, `generate-portrait.test.ts`: генератор.
- `packages/db/drizzle/0017_portrait_report_kind.sql` (+ snapshot и журнал).
- `apps/web/src/lib/portrait-report.ts`, `portrait-report.test.ts`.
- `apps/web/src/server/extra-reports.ts`, `extra-reports.test.ts` (вместо `life-cards.ts`, `life-cards.test.ts`).
- `apps/web/src/components/PortraitBlocks.tsx`, `PortraitBlocks.module.css`, `PortraitBlocks.test.tsx`.
- `scripts/seed-portrait-report.mjs`.
- `docs/redesign/CODEX_PORTRAIT_BLOCKS.md`.

**Изменить**
- `packages/core/src/reports.ts` (+test), `packages/ai/src/sections.ts`, `chapter-cards.ts`, `generate-chapter.ts`, `prompt.ts`, `testing.ts`, `index.ts` (+tests).
- `apps/worker/src/generate.ts`, `env.ts`, `main.ts`, `texts.ts`, `notify.ts` (+tests).
- `packages/db/src/reports.test.ts`.
- `apps/web/src/lib/report-view.ts`, `apps/web/src/server/payments-service.ts`, `payments-deps.ts`, `apps/web/src/components/personality-atlas/PersonalEdition.tsx`, `apps/web/src/app/report/[resultId]/page.tsx` (+tests).
- `packages/content/src/index.ts`, `deploy/env.example`, `deploy/server-setup.md`.

---

### Task 0: Ветка

- [ ] **Step 1: Закоммитить план на docs-ветке и создать рабочую**

```bash
git add docs/superpowers/plans/2026-10-13-personal-report-portrait-blocks.md
git commit -m "docs: implementation plan for the portrait blocks"
git switch -c feat/portrait-blocks
```

Ожидается: ветка `feat/portrait-blocks` от `docs/portrait-blocks-spec`.

---

### Task 1: Темы «Портрета» в content

**Files:**
- Create: `packages/content/src/portrait-seeds.ts`, `packages/content/src/portrait-seeds.test.ts`
- Modify: `packages/content/src/index.ts`

**Interfaces:**
- Produces: `type PortraitSeed = { id: string; title: string; focus: string; traits: readonly Trait[]; sections: readonly TraitSection[] }`; `portraitSeeds(): readonly PortraitSeed[]` (ровно 5, порядок как в Global Constraints); `PORTRAIT_SECTIONS: readonly TraitSection[]` (`["work","relationships","stress"]`, разделы, из которых берутся блоки входа).

- [ ] **Step 1: Падающий тест**

`packages/content/src/portrait-seeds.test.ts`:

```ts
import { TRAITS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { TRAIT_SECTIONS } from "./keys";
import { PORTRAIT_SECTIONS, portraitSeeds } from "./portrait-seeds";
import { findStopWords } from "./safety";

const APPROVED = [
  ["start", "Как ты берёшься за дело", ["openness", "conscientiousness"], ["work"]],
  ["talk", "Как ты общаешься", ["extraversion", "agreeableness"], ["relationships"]],
  ["load", "Что происходит под нагрузкой", ["stability"], ["stress"]],
  ["energy", "Что даёт тебе энергию", ["extraversion", "openness"], ["work", "relationships"]],
  ["support", "На что в тебе можно опереться", ["agreeableness", "conscientiousness"], ["relationships", "work"]],
] as const;

describe("portraitSeeds", () => {
  test("are the five approved blocks with titles, traits and library sections, in order", () => {
    expect(portraitSeeds().map((seed) => [seed.id, seed.title, seed.traits, seed.sections])).toEqual(APPROVED.map(([id, title, traits, sections]) => [id, title, traits, sections]));
  });

  test("ids and titles are unique, ids fit the id format, titles fit the schema, focus is descriptive", () => {
    const seeds = portraitSeeds();

    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(5);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(5);
    for (const seed of seeds) {
      expect(seed.id).toMatch(/^[a-z]{2,12}$/);
      expect(seed.title.length).toBeGreaterThanOrEqual(10);
      expect(seed.title.length).toBeLessThanOrEqual(60);
      expect(seed.focus.length).toBeGreaterThan(40);
      for (const trait of seed.traits) expect(TRAITS).toContain(trait);
      for (const section of seed.sections) expect(PORTRAIT_SECTIONS).toContain(section);
    }
  });

  test("the library sections of the input are real sections and cover every section a block uses", () => {
    for (const section of PORTRAIT_SECTIONS) expect(TRAIT_SECTIONS).toContain(section);
    expect(new Set(portraitSeeds().flatMap((seed) => seed.sections))).toEqual(new Set(PORTRAIT_SECTIONS.filter((section) => section !== "stress" || true)));
  });

  test("the blocks draw on all five traits", () => {
    expect(new Set(portraitSeeds().flatMap((seed) => seed.traits))).toEqual(new Set(TRAITS));
  });

  test("theme texts pass the stop-word check", () => {
    for (const seed of portraitSeeds()) expect(findStopWords(`${seed.title} ${seed.focus}`), seed.id).toEqual([]);
  });
});
```

Run: `pnpm vitest run packages/content/src/portrait-seeds.test.ts`
Expected: FAIL (`Cannot find module './portrait-seeds'`).

- [ ] **Step 2: Реализация**

`packages/content/src/portrait-seeds.ts`:

```ts
import type { Trait } from "@grani/core";
import type { TraitSection } from "./keys";

export type PortraitSeed = { readonly id: string; readonly title: string; readonly focus: string; readonly traits: readonly Trait[]; readonly sections: readonly TraitSection[] };

// Разделы библиотеки, из которых берутся блоки входа по каждой черте. «strengths» и «blind_spots» не берём:
// первый человек уже видел бесплатно, второй показан на вкладке отдельным блоком
export const PORTRAIT_SECTIONS: readonly TraitSection[] = ["work", "relationships", "stress"];

// Заголовки и порядок блоков задаёт редакция: структура одинакова у всех покупателей, ИИ пишет только текст под баллы человека
const PORTRAIT_SEEDS: readonly PortraitSeed[] = [
  { id: "start", title: "Как ты берёшься за дело", focus: "Как человек берётся за новое дело: с чего начинает, что помогает дойти до результата и где теряет интерес.", traits: ["openness", "conscientiousness"], sections: ["work"] },
  { id: "talk", title: "Как ты общаешься", focus: "Как человек ведёт себя в разговоре: что для него важнее, контакт или темп, как он слышит собеседника и говорит о своём.", traits: ["extraversion", "agreeableness"], sections: ["relationships"] },
  { id: "load", title: "Что происходит под нагрузкой", focus: "Что происходит с настроением и решениями, когда нагрузки становится много, и что помогает вернуть ясность.", traits: ["stability"], sections: ["stress"] },
  { id: "energy", title: "Что даёт тебе энергию", focus: "Где человек берёт силы: в новизне, в людях или в тишине, и как это сочетание влияет на его неделю.", traits: ["extraversion", "openness"], sections: ["work", "relationships"] },
  { id: "support", title: "На что в тебе можно опереться", focus: "В чём на человека могут положиться другие и как ему не перегрузить себя, оставаясь надёжным.", traits: ["agreeableness", "conscientiousness"], sections: ["relationships", "work"] },
];

export const portraitSeeds = (): readonly PortraitSeed[] => PORTRAIT_SEEDS;
```

В `packages/content/src/index.ts` после `export * from "./life-seeds";` добавить `export * from "./portrait-seeds";`.

В тесте убрать лишнее `.filter(...)`: заменить третий тест на

```ts
  test("the library sections of the input are real sections used by the blocks", () => {
    for (const section of PORTRAIT_SECTIONS) expect(TRAIT_SECTIONS).toContain(section);
    expect(new Set(portraitSeeds().flatMap((seed) => seed.sections))).toEqual(new Set(PORTRAIT_SECTIONS));
  });
```

Run: `pnpm vitest run packages/content/src/portrait-seeds.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 3: Коммит**

```bash
git add packages/content
git commit -m "feat(content): five editorial blocks for the portrait tab"
```

---

### Task 2: Вид отчёта `portrait`: ядро, схема, типы, миграция

**Files:**
- Modify: `packages/core/src/reports.ts`, `packages/core/src/reports.test.ts`
- Modify: `packages/ai/src/sections.ts`, `packages/ai/src/sections.test.ts`, `packages/ai/src/prompt.ts`
- Modify: `apps/worker/src/texts.ts`, `apps/worker/src/notify.ts`, `apps/worker/src/notify.test.ts`, `apps/worker/src/generate.ts`
- Create: `packages/db/drizzle/0017_portrait_report_kind.sql` (+ `meta/`)
- Modify: `packages/db/src/reports.test.ts`

**Interfaces:**
- Produces:
  - core: `REPORT_KINDS` включает `"portrait"`; `EXTRA_KINDS = ["life","portrait"] as const`; `type ExtraKind`; `isExtraKind(value: unknown): value is ExtraKind`; `unlockedKinds(["full"])` содержит `life` и `portrait`.
  - ai/sections: `PORTRAIT_BLOCKS = 5`; `PortraitSchema`, `PortraitModelSchema`; `type PortraitSections = { version: 1; headline: string; blocks: { seed: string; title: string; text: string }[] }`; `parsePortrait(value: unknown): PortraitSections | null`; `ReportSections.portrait`; `SECTION_SCHEMAS.portrait`.
- Consumes: ничего из других задач.

**Коммит 1 (код), потом коммит 2 (миграция).**

- [ ] **Step 1: Падающие тесты ядра и схемы**

В `packages/core/src/reports.test.ts` импорт: добавить `EXTRA_KINDS, isExtraKind` в строку импорта из `./reports`; в тесте «the life cards are not sold and open only with the full report» оставить как есть и добавить новый тест рядом:

```ts
  test("extra reports open with the full report, are not sold and are recognised by isExtraKind", () => {
    expect(EXTRA_KINDS).toEqual(["life", "portrait"]);
    for (const kind of EXTRA_KINDS) {
      expect(isReportKind(kind)).toBe(true);
      expect(isProduct(kind)).toBe(false);
      expect(unlockedKinds(["full"]).has(kind)).toBe(true);
      expect(unlockedKinds(["chapters_all"]).has(kind)).toBe(false);
      expect(unlockedKinds(["pair"]).has(kind)).toBe(false);
      expect(isExtraKind(kind)).toBe(true);
    }
    expect(isExtraKind("full")).toBe(false);
    expect(isExtraKind("chapter_money")).toBe(false);
    expect(isExtraKind(undefined)).toBe(false);
    expect(reportKindsFor("full")).toEqual(["full"]);
  });
```

Также в тесте «collects everything the purchases opened…» ожидаемый список дополнить: `"full", "life", "portrait"`.

В `packages/ai/src/sections.test.ts` (импорт `parsePortrait` добавить в строку импорта из `./sections`):

```ts
describe("parsePortrait", () => {
  const block = (seed: string) => ({ seed, title: long(20), text: long(200) });
  const portrait = (overrides: Record<string, unknown> = {}) => ({ version: 1, headline: long(60), blocks: ["sa", "sb", "sc", "sd", "se"].map(block), ...overrides });

  test("accepts a headline and five blocks of version 1, also through parseSections", () => {
    expect(parsePortrait(portrait())?.blocks).toHaveLength(5);
    expect(parseSections("portrait", portrait())?.headline).toHaveLength(60);
  });

  test("rejects other block counts, another version, short or long text and extra fields", () => {
    expect(parsePortrait(portrait({ blocks: ["sa", "sb", "sc", "sd"].map(block) }))).toBeNull();
    expect(parsePortrait(portrait({ blocks: ["sa", "sb", "sc", "sd", "se", "sf"].map(block) }))).toBeNull();
    expect(parsePortrait(portrait({ version: 2 }))).toBeNull();
    expect(parsePortrait(portrait({ blocks: ["sa", "sb", "sc", "sd", "se"].map((seed) => ({ ...block(seed), text: long(149) })) }))).toBeNull();
    expect(parsePortrait(portrait({ blocks: ["sa", "sb", "sc", "sd", "se"].map((seed) => ({ ...block(seed), text: long(351) })) }))).toBeNull();
    expect(parsePortrait(portrait({ summary: long(60) }))).toBeNull();
    expect(parsePortrait(null)).toBeNull();
  });
});
```

Run: `pnpm vitest run packages/core/src/reports.test.ts packages/ai/src/sections.test.ts`
Expected: FAIL.

- [ ] **Step 2: Ядро и схема**

`packages/core/src/reports.ts`:

```ts
export const REPORT_KINDS = ["full", "friends", "chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships", "pair", "life", "portrait"] as const;
```

После `isReportKind` добавить:

```ts
// Дополнительные отчёты открываются вместе с полным разбором, не продаются и не объявляются письмом «Готово»
export const EXTRA_KINDS = ["life", "portrait"] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

export function isExtraKind(value: unknown): value is ExtraKind {
  return typeof value === "string" && (EXTRA_KINDS as readonly string[]).includes(value);
}
```

Заменить `unlockedKinds`:

```ts
// Дополнительные отчёты не продаются: открываются вместе с полным разбором
export function unlockedKinds(owned: readonly Product[]): ReadonlySet<ReportKind> {
  const kinds = new Set(owned.flatMap(reportKindsFor));
  if (kinds.has("full")) for (const kind of EXTRA_KINDS) kinds.add(kind);
  return kinds;
}
```

`packages/ai/src/sections.ts`: после `LifeCardsSchema` добавить

```ts
// Вкладка «Портрет»: фраза-вывод и пять коротких блоков; заголовки подставляет код из тем, модель пишет только текст
export const PORTRAIT_BLOCKS = 5;
const portraitText = text(150, 350);
export const PortraitSchema = z.strictObject({
  version: z.literal(1),
  headline: cardsShape.headline,
  blocks: z.array(z.strictObject({ seed: text(2, 40), title: text(10, 60), text: portraitText })).length(PORTRAIT_BLOCKS),
});
export const PortraitModelSchema = z.strictObject({
  headline: cardsShape.headline,
  blocks: z.array(z.strictObject({ seed: text(2, 40), text: portraitText })).length(PORTRAIT_BLOCKS),
});
```

В типы: `export type PortraitSections = z.infer<typeof PortraitSchema>;`; в `ReportSections` добавить `portrait: PortraitSections`; в `SECTION_SCHEMAS` добавить `portrait: PortraitSchema,`; после `parseLifeCards`:

```ts
export function parsePortrait(value: unknown): PortraitSections | null {
  const parsed = PortraitSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
```

Run: `pnpm vitest run packages/core packages/ai/src/sections.test.ts` — Expected: PASS.

- [ ] **Step 3: Типы и защиты в ai и воркере**

`packages/ai/src/prompt.ts`: заменить `Exclude<ReportKind, "life">` на `Exclude<ReportKind, ExtraKind>`; импорт: `import type { ExtraKind, ReportKind } from "@grani/core";`.

`apps/worker/src/texts.ts`: импорт `type ExtraKind`; `type AnnouncedKind = Exclude<ReportKind, ExtraKind>;`.

`apps/worker/src/notify.ts`: импорт `isExtraKind` из `@grani/core`; строку `if (report.kind === "life") return true;` заменить на `if (isExtraKind(report.kind)) return true;`.

`apps/worker/src/generate.ts` в `buildInput`: строку `if (job.kind === "life") return null;` заменить на `if (isExtraKind(job.kind)) return null;`, добавить `isExtraKind` в импорт из `@grani/core`.

Run: `pnpm typecheck` — Expected: чисто. Если компилятор укажет другие `Exclude<…, "life">`, заменить так же.

- [ ] **Step 4: Коммит кода**

```bash
git add packages/core packages/ai apps/worker/src/texts.ts apps/worker/src/notify.ts apps/worker/src/generate.ts
git commit -m "feat: portrait report kind and a shared list of extra reports"
```

- [ ] **Step 5: Падающие тесты БД и уведомления**

`packages/db/src/reports.test.ts` в `describe("saveReport")` рядом с тестом про `life`:

```ts
  test("stores the portrait beside the other reports of a result", async () => {
    await saveReport(db, { target: { resultId }, kind: "full", sections: {}, source: "ai" });
    const portrait = await saveReport(db, { target: { resultId }, kind: "portrait", sections: { version: 1 }, source: "ai" });

    expect(portrait.created).toBe(true);
    expect((await getReport(db, { resultId }, "portrait"))?.sections).toEqual({ version: 1 });
  });
```

`apps/worker/src/notify.test.ts` рядом с тестом про `life`:

```ts
  test("says nothing about the portrait blocks either", async () => {
    const owner = await seedUserWithResult(db, { externalId: "311" });
    const { report } = await saveReport(db, { target: { resultId: owner.resultId }, kind: "portrait", sections: {}, source: "ai" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);

    expect(telegram).not.toHaveBeenCalled();
  });
```

Run: `pnpm vitest run packages/db/src/reports.test.ts apps/worker/src/notify.test.ts`
Expected: FAIL (`invalid input value for enum report_kind: "portrait"`).

- [ ] **Step 6: Миграция**

```bash
pnpm --filter @grani/db exec drizzle-kit generate --name portrait_report_kind
```

Проверить: `packages/db/drizzle/0017_portrait_report_kind.sql` содержит единственный оператор `ALTER TYPE "public"."report_kind" ADD VALUE 'portrait';`, плюс `meta/0017_snapshot.json` и запись в `meta/_journal.json`. Если генератор предложил что-то ещё, остановиться и разобраться.

Run: `pnpm vitest run packages/db apps/worker`
Expected: PASS (если `practice-upgrade` или `personality-atlas-upgrade` упали по таймауту, запустить их отдельно).

- [ ] **Step 7: Коммит миграции отдельно**

```bash
git add packages/db apps/worker/src/notify.test.ts
git commit -m "feat(db): add the portrait value to the report_kind enum"
```

---

### Task 3: Генерация портрета в пакете ai

**Files:**
- Modify: `packages/ai/src/chapter-cards.ts` (экспорт общих проверок и правил)
- Modify: `packages/ai/src/generate-chapter.ts` (общий `runPrompt`)
- Create: `packages/ai/src/portrait-cards.ts`, `packages/ai/src/portrait-cards.test.ts`
- Create: `packages/ai/src/generate-portrait.ts`, `packages/ai/src/generate-portrait.test.ts`
- Modify: `packages/ai/src/testing.ts`, `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: `portraitSeeds`, `PORTRAIT_SECTIONS` (Task 1); `PortraitModelSchema`, `PortraitSections`, `parsePortrait`, `PORTRAIT_BLOCKS` (Task 2).
- Produces:
  - `chapter-cards.ts` экспортирует `reviewStyle`, `mergeReviews`, `styleFailure`, `schemaFailure`, `hasStopWords`, `MAX_HEDGES_PER_CARD`, `MAX_HEDGES_PER_CARD_FINAL`, `REPEAT_HINT`-аналог не нужен; `type StyleReview`; `RULE_VOICE`, `RULE_GENDER`, `RULE_FIX`, `RULE_HEDGES` (строки правил, вставленные на прежние места в `RULES`, текст запроса глав не меняется).
  - `generate-chapter.ts`: `runPrompt<T>(writer, label: { kind: string; part: string }, prompt: Prompt, check: (raw: string, final: boolean) => PartCheck<T>, options): Promise<{ value: T; attempts: number } | null>`; `runPart` вызывает его.
  - `portrait-cards.ts`: `type PortraitContext = { library: Library; result: PersonalScores }`; `buildPortraitPrompt(ctx): Prompt`; `freeTexts(ctx): readonly string[]` (то, что человек видит бесплатно); `portraitSources(ctx): readonly string[]` (`freeTexts` + блоки входа); `validatePortrait(raw: string, sources: readonly string[], final?: boolean): PartCheck<PortraitModelOutput>`; `type PortraitModelOutput = z.infer<typeof PortraitModelSchema>`; `assemblePortrait(output: PortraitModelOutput): PortraitSections | null`.
  - `generate-portrait.ts`: `generatePortrait(writer: ReportWriter, ctx: PortraitContext, options?: { timeoutMs?; attempts?; log? }): Promise<{ sections: PortraitSections; attempts: number } | null>`.
  - `testing.ts`: `samplePortrait()` (ответ модели `{ headline, blocks: [{seed,text}] }`) и `portraitStubWriter(script?: readonly (string | Error | "hang")[]): ReportWriter & { calls: Prompt[] }`.

- [ ] **Step 1: Общие проверки: экспорт без изменения поведения глав**

Run до правки: `pnpm vitest run packages/ai/src/chapter-cards.test.ts packages/ai/src/generate-chapter.test.ts` — Expected: PASS.

В `packages/ai/src/chapter-cards.ts`:

1. Вынести строки правил в именованные константы (текст дословно прежний) и подставить их в `RULES` на те же места. Было:

```ts
const RULES = [
  ...COMMON_RULES,
  "Пиши по-русски, на «ты», обращаясь к одному человеку.",
  "Текст должен подходить читателю любого пола: …",
  "Если во входе есть поле fix, это замечания к твоему прошлому ответу: исправь именно их, остальное сохрани.",
  "Ситуации — это примеры …",
  "«Что сказать» — готовые фразы …",
  "Не более одной оговорки («может», «возможно», «можно сравнить») на карточку: пиши прямо, как опытный редактор.",
  "Не пересказывай блоки слово в слово: …",
  "«Что сделать» — своё действие …",
];
```

Стало: четыре константы `export const RULE_VOICE = "…"`, `RULE_GENDER`, `RULE_FIX`, `RULE_HEDGES` (те же четыре строки дословно) перед `RULES`, а в массиве на их местах стоят эти константы; остальные строки не трогать.

2. Добавить `export` к: `MAX_HEDGES_PER_CARD`, `MAX_HEDGES_PER_CARD_FINAL`, `schemaFailure`, `hasStopWords`, `type StyleReview`, `reviewStyle`, `mergeReviews`, `styleFailure`.

В `packages/ai/src/generate-chapter.ts` заменить `runPart` на пару:

```ts
export async function runPrompt<T>(writer: ReportWriter, label: { kind: string; part: string }, prompt: Prompt, check: (raw: string, final: boolean) => PartCheck<T>, options: Options): Promise<PartResult<T> | null> {
  const attempts = options.attempts ?? GENERATION_ATTEMPTS;
  let hint: string | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let reason: string;
    let detail: string | undefined;
    try {
      const checked = check(await completeWithTimeout(writer, withFix(prompt, hint), options.timeoutMs ?? GENERATION_TIMEOUT_MS), attempt === attempts);
      if (checked.ok) {
        if (checked.forgiven) options.log?.("chapter part accepted with remarks", { kind: label.kind, writer: writer.name, part: label.part, attempt, forgiven: checked.forgiven });
        return { value: checked.value, attempts: attempt };
      }
      reason = checked.reason;
      detail = checked.detail;
      hint = checked.hint;
    } catch (error) {
      reason = error instanceof TimeoutError ? "timeout" : `error: ${String(error)}`;
    }
    // Текст ответа в лог не пишется: в нём может оказаться то, что проверка как раз не пропустила
    options.log?.("chapter part rejected", { kind: label.kind, writer: writer.name, part: label.part, attempt, reason, ...(detail ? { detail } : {}) });
  }
  return null;
}

export function runPart<T>(writer: ReportWriter, part: ChapterPart, ctx: ChapterCardsContext, check: (raw: string, final: boolean) => PartCheck<T>, options: Options): Promise<PartResult<T> | null> {
  return runPrompt(writer, { kind: ctx.kind, part }, buildChapterPartPrompt(part, ctx), check, options);
}
```

(`PartResult` и `Options` типы остаются в файле; сделать `Options` и `PartResult` экспортируемыми: `export type`.)

Run: `pnpm vitest run packages/ai` — Expected: PASS без изменений тестов (поведение глав и «В жизни» то же).

- [ ] **Step 2: Падающие тесты проверки и запроса**

`packages/ai/src/portrait-cards.test.ts`:

```ts
import { portraitSeeds, stabilityText, traitBlock, typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { TRAITS, traitLevel } from "@grani/core";
import { describe, expect, test } from "vitest";
import { assemblePortrait, buildPortraitPrompt, freeTexts, portraitSources, validatePortrait, type PortraitContext } from "./portrait-cards";
import { SAMPLE_SCORES, samplePortrait } from "./testing";

const CTX: PortraitContext = { library: getLibrary(), result: SAMPLE_SCORES };
const answer = (patch: (value: ReturnType<typeof samplePortrait>) => unknown = (value) => value) => JSON.stringify(patch(samplePortrait()));
const SOURCES = portraitSources(CTX);

describe("buildPortraitPrompt", () => {
  test("carries the facts, the five themes and, per trait, only the work, relationships and stress blocks", () => {
    const prompt = buildPortraitPrompt(CTX);
    const user = JSON.parse(prompt.user) as { facts: { traits: unknown[] }; seeds: { id: string; title: string }[]; blocks: Record<string, Record<string, string>> };

    expect(user.seeds.map((seed) => seed.id)).toEqual(portraitSeeds().map((seed) => seed.id));
    expect(user.facts.traits).toHaveLength(5);
    expect(Object.keys(user.blocks)).toEqual([...TRAITS]);
    for (const trait of TRAITS) expect(Object.keys(user.blocks[trait]!)).toEqual(["work", "relationships", "stress"]);
    const level = traitLevel(SAMPLE_SCORES.scores.openness);
    expect(user.blocks.openness!.work).toBe(traitBlock(getLibrary(), "openness", level, "work"));
    expect(prompt.system).toContain('"headline"');
    expect(prompt.system).toContain('"blocks"');
    expect(prompt.system).toContain("на «ты»");
    expect(prompt.system).toContain("не пересказывай");
  });

  test("the free texts never go into the prompt as material to retell", () => {
    const prompt = buildPortraitPrompt(CTX);

    for (const text of freeTexts(CTX)) expect(prompt.user).not.toContain(text.slice(0, 60));
  });
});

describe("freeTexts and portraitSources", () => {
  test("freeTexts are what the free result page shows: type texts, stability and the strengths blocks", () => {
    const texts = freeTexts(CTX);
    const types = typeTexts(getLibrary(), SAMPLE_SCORES.typeCode);

    expect(texts).toContain(types.short);
    expect(texts).toContain(types.long);
    expect(texts).toContain(stabilityText(getLibrary(), SAMPLE_SCORES.stability));
    expect(texts).toContain(traitBlock(getLibrary(), "openness", traitLevel(SAMPLE_SCORES.scores.openness), "strengths"));
    expect(portraitSources(CTX).length).toBeGreaterThan(texts.length);
  });
});

describe("validatePortrait", () => {
  test("accepts a good answer, also wrapped in an explanation and a Markdown fence", () => {
    expect(validatePortrait(answer(), SOURCES).ok).toBe(true);
    expect(validatePortrait("Вот ответ:\n```json\n" + answer() + "\n```\nГотово.", SOURCES).ok).toBe(true);
  });

  test("rejects broken JSON and a wrong schema with the fields at fault", () => {
    expect(validatePortrait("не json", SOURCES)).toEqual({ ok: false, reason: "not_json" });
    const schema = validatePortrait("{}", SOURCES);
    expect(schema).toMatchObject({ ok: false, reason: "schema" });
    if (!schema.ok) expect(schema.hint).toContain("headline");
  });

  test("rejects blocks in a wrong order or with unknown themes", () => {
    const wrong = validatePortrait(answer((value) => ({ ...value, blocks: [...value.blocks].reverse() })), SOURCES);

    expect(wrong).toMatchObject({ ok: false, reason: "seeds" });
  });

  test("rejects a gendered form with a concrete remark, and forgives it on the last attempt", () => {
    const gendered = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 0 ? { ...block, text: `${block.text} Ты открыт новому и не боишься перемен.` } : block)) }));

    const early = validatePortrait(gendered, SOURCES, false);
    expect(early).toMatchObject({ ok: false, reason: "style" });
    if (!early.ok) expect(early.hint).toContain("ты открыт");

    expect(validatePortrait(gendered, SOURCES, true)).toMatchObject({ ok: true, forgiven: expect.arrayContaining(["gendered"]) });
  });

  test("rejects a block that retells a free text, forgives it on the last attempt", () => {
    const retold = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 1 ? { ...block, text: typeTexts(getLibrary(), SAMPLE_SCORES.typeCode).short.slice(0, 340) } : block)) }));

    const early = validatePortrait(retold, SOURCES, false);
    expect(early).toMatchObject({ ok: false, reason: "repeat" });
    expect(validatePortrait(retold, SOURCES, true)).toMatchObject({ ok: true, forgiven: ["repeat"] });
  });

  test("rejects two blocks that say the same thing", () => {
    const twins = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 3 ? { ...block, text: value.blocks[2]!.text } : block)) }));

    expect(validatePortrait(twins, SOURCES, false)).toMatchObject({ ok: false, reason: "repeat" });
  });
});

describe("assemblePortrait", () => {
  test("takes the titles from the themes, not from the model", () => {
    const checked = validatePortrait(answer(), SOURCES);
    if (!checked.ok) throw new Error("fixture is not valid");
    const sections = assemblePortrait(checked.value);

    expect(sections?.version).toBe(1);
    expect(sections?.blocks.map((block) => block.title)).toEqual(portraitSeeds().map((seed) => seed.title));
  });
});
```

Run: `pnpm vitest run packages/ai/src/portrait-cards.test.ts`
Expected: FAIL (`Cannot find module './portrait-cards'`).

- [ ] **Step 3: Образец ответа и заглушка модели**

В `packages/ai/src/testing.ts` добавить (импорт `portraitSeeds` из `@grani/content` в существующую строку):

```ts
// Корректный ответ модели для портрета: фраза и пять блоков по темам, у каждого своя мысль
export function samplePortrait() {
  const texts = [
    "Ты быстро загораешься новой идеей, но доводишь её до результата, когда есть понятные шаги. Поэтому полезно сразу записать первый маленький шаг и срок: так интерес не растворяется в планах, а превращается в действие.",
    "В разговоре тебе важны и контакт, и спокойный темп. Ты слышишь собеседника, но иногда соглашаешься быстрее, чем успеваешь понять, чего хочется тебе самому. Короткая пауза перед ответом возвращает голос и никого не обижает.",
    "Под нагрузкой тебе нужно сначала снизить шум вокруг, а уже потом принимать решения. Помогает список из трёх дел на сегодня и одно окно без уведомлений. Когда сигналов становится меньше, возвращаются ясность и ровное настроение.",
    "Силы к тебе возвращаются там, где есть и свобода пробовать новое, и живые люди рядом. Тихий вечер без планов полезен, но если он затягивается, потянет к разговору. Договорись с собой о паре встреч в неделю и одном дне для себя.",
    "Тебе легко доверяют: ты замечаешь, что нужно другим, и помнишь про договорённости. Чтобы надёжность не превращалась в перегруз, заранее называй, сколько времени и сил ты готов дать, и оставляй запас на собственные дела.",
  ];
  return {
    headline: "Ты соединяешь интерес к новому с заботой о людях и порядком, и тебе важно беречь на это силы",
    blocks: portraitSeeds().map((seed, index) => ({ seed: seed.id, text: texts[index]! })),
  };
}

// Заглушка модели для портрета: по умолчанию отвечает корректно, script задаёт цепочку ответов
export function portraitStubWriter(script: readonly Step[] = []): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const queue = [...script];
  return {
    name: "stub",
    calls,
    async complete(prompt) {
      calls.push(prompt);
      const step = queue.shift();
      if (step === "hang") return new Promise<string>(() => {});
      if (step instanceof Error) throw step;
      return typeof step === "string" ? step : JSON.stringify(samplePortrait());
    },
  };
}
```

(`Step` уже объявлен выше в файле; `portraitStubWriter` размещать после его объявления.)

Важно: в одном из текстов блока 5 есть «ты готов»; это формула рода («ты готов») и будет отклонена проверкой рода. Заменить в тексте блока 5 «сколько времени и сил ты готов дать» на «сколько времени и сил можно дать». Если после запуска тестов проверка стиля или длины отклонит какой-то образец, исправить именно образец, не проверку, и записать это в журнал решений.

- [ ] **Step 4: Реализация запроса, проверки и сборки**

`packages/ai/src/portrait-cards.ts`:

```ts
import { findStopWords, PORTRAIT_SECTIONS, portraitSeeds, stabilityText, traitBlock, typeTexts, type Library } from "@grani/content";
import { TRAITS, traitLevel, type Trait } from "@grani/core";
import type { z } from "zod";
import {
  hasStopWords,
  MAX_HEDGES_PER_CARD,
  MAX_HEDGES_PER_CARD_FINAL,
  mergeReviews,
  reviewStyle,
  RULE_FIX,
  RULE_GENDER,
  RULE_HEDGES,
  RULE_VOICE,
  schemaFailure,
  styleFailure,
  type PartCheck,
} from "./chapter-cards";
import { repeatsAny } from "./chapter-overlap";
import { personalFacts, type PersonalScores } from "./input";
import { COMMON_RULES, type Prompt } from "./prompt";
import { parsePortrait, PORTRAIT_BLOCKS, PortraitModelSchema, sectionStrings, type PortraitSections } from "./sections";
import { extractJson } from "./validate";

export type PortraitContext = { library: Library; result: PersonalScores };
export type PortraitModelOutput = z.infer<typeof PortraitModelSchema>;

const RULES = [
  ...COMMON_RULES,
  RULE_VOICE,
  RULE_GENDER,
  RULE_FIX,
  "Не утверждай о прошлом читателя: нельзя писать «ты уже…», «у тебя было…», «ты всегда…», «ты никогда…».",
  RULE_HEDGES,
  "Каждый блок — две-три короткие фразы без списков: одна мысль о том, как черты читателя работают вместе, и один конкретный шаг.",
  "Не пересказывай блоки и общие описания типа: объясняй своими словами, как сочетание черт проявляется в жизни этого человека.",
];

const SHAPE = [
  '{"headline": "главный вывод о человеке, 40–140 знаков",',
  ' "blocks": [{"seed": "id темы из seeds", "text": "короткий текст, 150–350 знаков"}]}',
  `Дай ровно ${PORTRAIT_BLOCKS} объектов в blocks, по одному на тему из seeds, в том же порядке; seed — её id.`,
].join("\n");

const SECTION_ORDER = PORTRAIT_SECTIONS;

const blocksOf = (ctx: PortraitContext): Record<Trait, Record<string, string>> =>
  Object.fromEntries(
    TRAITS.map((trait) => [trait, Object.fromEntries(SECTION_ORDER.map((section) => [section, traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), section)]))]),
  ) as Record<Trait, Record<string, string>>;

// То, что человек уже видел бесплатно на странице результата: новый портрет не должен это пересказывать.
// В запрос эти тексты не передаются, они нужны только проверке
export function freeTexts(ctx: PortraitContext): readonly string[] {
  const types = typeTexts(ctx.library, ctx.result.typeCode);
  return [
    types.short,
    types.long,
    stabilityText(ctx.library, ctx.result.stability),
    ...TRAITS.map((trait) => traitBlock(ctx.library, trait, traitLevel(ctx.result.scores[trait]), "strengths")),
  ];
}

// Источники для проверки на пересказ: бесплатные тексты и блоки, которые модель получила на вход
export function portraitSources(ctx: PortraitContext): readonly string[] {
  return [...freeTexts(ctx), ...Object.values(blocksOf(ctx)).flatMap((sections) => Object.values(sections))];
}

export function buildPortraitPrompt(ctx: PortraitContext): Prompt {
  const seeds = portraitSeeds().map(({ id, title, focus, traits }) => ({ id, title, focus, traits }));
  return {
    system: [...RULES, `Схема ответа:\n${SHAPE}`].join("\n\n"),
    // Во входе только баллы, уровни, темы и блоки: имён, идентификаторов и бесплатных текстов в нём нет
    user: JSON.stringify({ facts: personalFacts(ctx.result), seeds, blocks: blocksOf(ctx) }),
  };
}

const REPEAT_HINT = "Текст повторяет готовые тексты или соседний блок: напиши своими словами, как черты читателя работают вместе.";

export function validatePortrait(raw: string, sources: readonly string[], final = false): PartCheck<PortraitModelOutput> {
  const json = extractJson(raw);
  if (json === undefined) return { ok: false, reason: "not_json" };
  const parsed = PortraitModelSchema.safeParse(json);
  if (!parsed.success) return schemaFailure(parsed.error);
  if (hasStopWords(parsed.data)) return { ok: false, reason: "stop_words" };
  const strings = [parsed.data.headline, ...parsed.data.blocks.map((block) => block.text)];
  const review = mergeReviews(strings.map((text) => reviewStyle([text], MAX_HEDGES_PER_CARD, MAX_HEDGES_PER_CARD_FINAL, final)));
  if (review.fail.length > 0) return styleFailure(review);
  const expected = portraitSeeds().map((seed) => seed.id);
  const seeds = parsed.data.blocks.map((block) => block.seed);
  if (seeds.some((seed, index) => seed !== expected[index])) return { ok: false, reason: "seeds" };
  const texts = parsed.data.blocks.map((block) => block.text);
  const repeated = strings.some((text, index) => repeatsAny(text, [...sources, ...texts.filter((_, other) => other !== index - 1)]));
  if (repeated && !final) return { ok: false, reason: "repeat", hint: REPEAT_HINT };
  const forgiven = [...review.forgiven, ...(repeated ? ["repeat"] : [])];
  return { ok: true, value: parsed.data, ...(forgiven.length > 0 ? { forgiven } : {}) };
}

export function assemblePortrait(output: PortraitModelOutput): PortraitSections | null {
  const seeds = portraitSeeds();
  return parsePortrait({ version: 1, headline: output.headline, blocks: output.blocks.map((block, index) => ({ seed: block.seed, title: seeds[index]!.title, text: block.text })) });
}

export { sectionStrings };
```

Последнюю строку `export { sectionStrings };` убрать (она не нужна; импорт `sectionStrings` тоже убрать, если он не используется).

Нюансы, на которые обратить внимание при запуске: `strings` включает фразу-вывод на индексе 0, блоки на индексах 1–5; в проверке «соседний блок» для `headline` (index 0) исключается блок `index - 1 = -1`, то есть ничего: `headline` сравнивается со всеми блоками; для блока `i` исключается он сам. Если тест «два блока говорят одно» ложно срабатывает на нормальных образцах, проверить пороги `repeatsAny` (тройки слов, 50%) и не менять их.

Run: `pnpm vitest run packages/ai/src/portrait-cards.test.ts`
Expected: PASS. Падение на образцах (длина, стиль) исправлять в `samplePortrait`, записав в журнал решений.

- [ ] **Step 5: Падающие тесты генератора**

`packages/ai/src/generate-portrait.test.ts`:

```ts
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { generatePortrait } from "./generate-portrait";
import { portraitStubWriter, SAMPLE_SCORES, samplePortrait } from "./testing";

const CTX = { library: getLibrary(), result: SAMPLE_SCORES };

describe("generatePortrait", () => {
  test("makes one request and assembles a headline and five blocks with the editorial titles", async () => {
    const stub = portraitStubWriter();

    const result = await generatePortrait(stub, CTX);

    expect(stub.calls).toHaveLength(1);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.version).toBe(1);
    expect(result?.sections.blocks).toHaveLength(5);
    expect(result?.sections.blocks[0]?.title).toBe("Как ты берёшься за дело");
  });

  test("retries a broken answer and logs the part", async () => {
    const log = vi.fn();
    const stub = portraitStubWriter(["не json"]);

    const result = await generatePortrait(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(2);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ kind: "portrait", part: "portrait", attempt: 1, reason: "not_json" }));
  });

  test("a retry carries the concrete remark about the previous answer", async () => {
    const stub = portraitStubWriter(["{}"]);

    await generatePortrait(stub, CTX);

    expect((JSON.parse(stub.calls[1]!.user) as { fix?: string }).fix).toContain("headline");
  });

  test("gives up with null after five rejected attempts", async () => {
    const stub = portraitStubWriter(["{}", "{}", "{}", "{}", "{}"]);

    expect(await generatePortrait(stub, CTX)).toBeNull();
    expect(stub.calls).toHaveLength(5);
  });

  test("the last attempt forgives a gendered form and says so in the log", async () => {
    const log = vi.fn();
    const gendered = JSON.stringify({ ...samplePortrait(), headline: "Ты открыт новому и умеешь доводить начатое до конца, если рядом есть понятный срок" });
    const stub = portraitStubWriter([gendered, gendered, gendered, gendered, gendered]);

    const result = await generatePortrait(stub, CTX, { log });

    expect(result?.attempts).toBe(5);
    expect(log).toHaveBeenCalledWith("chapter part accepted with remarks", expect.objectContaining({ kind: "portrait", attempt: 5, forgiven: expect.arrayContaining(["gendered"]) }));
  });
});
```

Run: `pnpm vitest run packages/ai/src/generate-portrait.test.ts`
Expected: FAIL (`Cannot find module './generate-portrait'`).

- [ ] **Step 6: Реализация генератора**

`packages/ai/src/generate-portrait.ts`:

```ts
import type { GenerateLog, ReportWriter } from "./generate";
import { CARD_ATTEMPTS, runPrompt } from "./generate-chapter";
import { assemblePortrait, buildPortraitPrompt, portraitSources, validatePortrait, type PortraitContext } from "./portrait-cards";
import type { PortraitSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };

// Фраза и пять блоков «Портрета» одним запросом. Если за все попытки не получилось, возвращается null:
// запасного текста у вкладки нет, на странице остаётся нынешний вид
export async function generatePortrait(writer: ReportWriter, ctx: PortraitContext, rawOptions: Options = {}): Promise<{ sections: PortraitSections; attempts: number } | null> {
  const options: Options = { attempts: CARD_ATTEMPTS, ...rawOptions };
  const sources = portraitSources(ctx);
  const result = await runPrompt(writer, { kind: "portrait", part: "portrait" }, buildPortraitPrompt(ctx), (raw, final) => validatePortrait(raw, sources, final), options);
  if (!result) return null;
  const sections = assemblePortrait(result.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: "portrait", writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: result.attempts };
}
```

В `packages/ai/src/index.ts` после `export * from "./generate-life";` добавить `export * from "./portrait-cards";` и `export * from "./generate-portrait";`.

Run: `pnpm vitest run packages/ai packages/content && pnpm --filter @grani/ai typecheck`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add packages/ai packages/content
git commit -m "feat(ai): generate the portrait blocks and check them against the free result texts"
```

---

### Task 4: Воркер: флаг `PORTRAIT_V1` и общий запуск дополнительных отчётов

**Files:**
- Modify: `apps/worker/src/env.ts`, `apps/worker/src/env.test.ts`
- Modify: `apps/worker/src/generate.ts`, `apps/worker/src/generate.test.ts`
- Modify: `apps/worker/src/main.ts`

**Interfaces:**
- Consumes: `generatePortrait` (Task 3), `EXTRA_KINDS`, `isExtraKind`, `ExtraKind` (Task 2).
- Produces: `WorkerEnv.portraitV1: boolean`; `GenerateDeps.portraitV1?: boolean`; `runGenerate({ kind: "portrait", resultId }, deps)` пишет отчёт `portrait` с `source: "ai"` или ничего; общий `runExtra` вместо `runLife`.

- [ ] **Step 1: Падающие тесты**

`apps/worker/src/env.test.ts`: в двух существующих `toEqual` добавить `portraitV1: false` рядом с `lifeCardsV1: false`; добавить:

```ts
test("the portrait blocks are off unless PORTRAIT_V1 is 1", () => {
  expect(readWorkerEnv(BASE).portraitV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, PORTRAIT_V1: "0" }).portraitV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, PORTRAIT_V1: "1" }).portraitV1).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, PORTRAIT_V1: "yes" })).toThrow(/PORTRAIT_V1/);
});
```

`apps/worker/src/generate.test.ts` (импорт `portraitStubWriter` из `@grani/ai/testing` добавить к `cardsStubWriter`), в конец файла:

```ts
describe("portrait blocks", () => {
  const portraitJob = () => ({ kind: "portrait" as const, resultId: anna.resultId });

  beforeEach(() => {
    deps.portraitV1 = true;
  });

  test("a paid owner gets a headline and five blocks written by the model, with no announcement", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;

    await runGenerate(portraitJob(), deps);

    const report = await getReport(db, { resultId: anna.resultId }, "portrait");
    expect(report?.source).toBe("ai");
    expect(parseSections("portrait", report?.sections)?.blocks).toHaveLength(5);
    expect(stub.calls).toHaveLength(1);
    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });

  test("without the flag nothing is asked and nothing is saved, and the life flag does not enable it", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;
    deps.portraitV1 = false;
    deps.lifeCardsV1 = true;

    await runGenerate(portraitJob(), deps);

    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();
  });

  test("without the model or without the paid full report nothing is saved", async () => {
    await payFull();
    deps.writer = null;
    await runGenerate(portraitJob(), deps);
    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();

    const other = await seedUserWithResult(db, { externalId: "boris" });
    const stub = portraitStubWriter();
    deps.writer = stub;
    await runGenerate({ kind: "portrait", resultId: other.resultId }, deps);
    expect(stub.calls).toHaveLength(0);
    expect(await getReport(db, { resultId: other.resultId }, "portrait")).toBeNull();
  });

  test("when every attempt fails nothing is saved and the failure is logged without the answer text", async () => {
    await payFull();
    deps.writer = portraitStubWriter(["{}", "{}", "{}", "{}", "{}"]);

    await runGenerate(portraitJob(), deps);

    expect(await getReport(db, { resultId: anna.resultId }, "portrait")).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("warn", "portrait failed", { kind: "portrait" });
  });

  test("a second run does not ask the model again", async () => {
    await payFull();
    const stub = portraitStubWriter();
    deps.writer = stub;

    await runGenerate(portraitJob(), deps);
    await runGenerate(portraitJob(), deps);

    expect(stub.calls).toHaveLength(1);
  });
});
```

Run: `pnpm vitest run apps/worker/src/env.test.ts apps/worker/src/generate.test.ts`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`apps/worker/src/env.ts`: в схему после `LIFE_CARDS_V1`: `PORTRAIT_V1: z.enum(["0", "1"]).optional(),`; в `WorkerEnv` добавить `portraitV1: boolean`; в возвращаемый объект `portraitV1: env.PORTRAIT_V1 === "1",`.

`apps/worker/src/generate.ts`:

1. Импорты: `generatePortrait` и типы `GenerateLog`, `PersonalScores`, `ReportWriter` из `@grani/ai`; `isExtraKind`, `type ExtraKind` из `@grani/core`; `type Library` уже импортирован.
2. В `GenerateDeps` после `lifeCardsV1`: `// Блоки «Портрета»; по умолчанию выключено` и `portraitV1?: boolean;`.
3. Заменить блок `LifeJob`/`isLife`/`runLife` на:

```ts
type ExtraJob = { kind: ExtraKind; resultId: string };
const isExtra = (job: GenerateJob): job is ExtraJob => isExtraKind(job.kind);

type ExtraContext = { library: Library; result: PersonalScores };
type ExtraRun = { sections: unknown; attempts: number } | null;
type Extra = { enabled: (deps: GenerateDeps) => boolean; failure: string; generate: (writer: ReportWriter, ctx: ExtraContext, log: GenerateLog) => Promise<ExtraRun> };

// Дополнительные отчёты не имеют запасного текста: запасной вариант — прежний вид вкладки.
// Поэтому без ИИ, без флага, без оплаченного разбора или после исчерпанных попыток отчёт просто не сохраняется
const EXTRAS: Readonly<Record<ExtraKind, Extra>> = {
  life: { enabled: (deps) => deps.lifeCardsV1 === true, failure: "life cards failed", generate: (writer, ctx, log) => generateLifeCards(writer, ctx, { log }) },
  portrait: { enabled: (deps) => deps.portraitV1 === true, failure: "portrait failed", generate: (writer, ctx, log) => generatePortrait(writer, ctx, { log }) },
};

async function runExtra(job: ExtraJob, deps: GenerateDeps): Promise<void> {
  const extra = EXTRAS[job.kind];
  if (!extra.enabled(deps) || deps.writer === null) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const target = { resultId: job.resultId };
  const result = await getResult(deps.db, job.resultId);
  // Сайт проверил доступ при постановке задачи; проверяем ещё раз — между ними могло пройти время
  if (!result || !unlockedKinds(await listOwnedProducts(deps.db, target)).has(job.kind)) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const generated = await extra.generate(deps.writer, { library: deps.library, result }, (message, extraFields) => deps.log("warn", message, extraFields));
  if (!generated) {
    deps.log("warn", extra.failure, { kind: job.kind });
    return;
  }
  const { created } = await saveReport(deps.db, { target, kind: job.kind, sections: generated.sections, source: "ai" });
  deps.log("info", "report generated", { kind: job.kind, source: "ai", attempts: generated.attempts, created });
}
```

4. В `runGenerate` строку `if (isLife(job)) return runLife(job, deps);` заменить на `if (isExtra(job)) return runExtra(job, deps);`.

`apps/worker/src/main.ts`: в `runGenerate(... { …, lifeCardsV1: env.lifeCardsV1 })` добавить `portraitV1: env.portraitV1`; в `log("info", "worker started", …)` добавить `portraitV1: env.portraitV1`.

Run: `pnpm vitest run apps/worker && pnpm --filter @grani/worker typecheck`
Expected: PASS, включая прежние тесты `life cards` (журнал `life cards failed` сохранён).

- [ ] **Step 3: Коммит**

```bash
git add apps/worker
git commit -m "feat(worker): write the portrait blocks behind PORTRAIT_V1 through a shared extra-report runner"
```

---

### Task 5: Сайт: отчёт `portrait` в представлении страницы

**Files:**
- Create: `apps/web/src/lib/portrait-report.ts`, `apps/web/src/lib/portrait-report.test.ts`
- Modify: `apps/web/src/lib/report-view.ts`, `apps/web/src/lib/report-view.test.ts`
- Modify: фикстуры `ReportPageView`, на которые укажет typecheck (`PersonalEdition.test.tsx`, `PersonalEdition.covers.test.tsx`)

**Interfaces:**
- Consumes: `parseSections("portrait", …)`, `PortraitSections` (Task 2), `samplePortrait` (Task 3).
- Produces: `parsePortraitReport(report: Pick<ReportRecord, "sections"> | null | undefined): PortraitSections | null`; `ReportPageView.portrait: PortraitSections | null` (не `null` только если открыт `portrait` и отчёт корректен; на `preparing` не влияет).

- [ ] **Step 1: Падающие тесты**

`apps/web/src/lib/portrait-report.test.ts`:

```ts
import { parsePortrait } from "@grani/ai";
import { samplePortrait } from "@grani/ai/testing";
import { portraitSeeds } from "@grani/content";
import { describe, expect, test } from "vitest";
import { parsePortraitReport } from "./portrait-report";

const valid = { version: 1, headline: samplePortrait().headline, blocks: samplePortrait().blocks.map((block, index) => ({ ...block, title: portraitSeeds()[index]!.title })) };

describe("parsePortraitReport", () => {
  test("returns the blocks of a valid report", () => {
    expect(parsePortraitReport({ sections: valid })?.blocks).toHaveLength(5);
    expect(parsePortrait(valid)).not.toBeNull();
  });

  test("a missing, damaged or outdated report counts as no report", () => {
    expect(parsePortraitReport(null)).toBeNull();
    expect(parsePortraitReport(undefined)).toBeNull();
    expect(parsePortraitReport({ sections: {} })).toBeNull();
    expect(parsePortraitReport({ sections: { ...valid, version: 2 } })).toBeNull();
    expect(parsePortraitReport({ sections: { ...valid, blocks: valid.blocks.slice(0, 4) } })).toBeNull();
    expect(parsePortraitReport({ sections: "мусор" })).toBeNull();
  });
});
```

В `apps/web/src/lib/report-view.test.ts` (импорт `samplePortrait` из `@grani/ai/testing`, `portraitSeeds` из `@grani/content`):

```ts
describe("portrait blocks in the page view", () => {
  const PORTRAIT = { version: 1, headline: samplePortrait().headline, blocks: samplePortrait().blocks.map((block, index) => ({ ...block, title: portraitSeeds()[index]!.title })) };

  test("the owner of the full report sees the blocks", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("portrait", PORTRAIT)], friendsCount: 0 });

    expect(view.portrait?.blocks).toHaveLength(5);
  });

  test("without the full report a stored portrait stays hidden", () => {
    const view = buildReportPageView({ owned: [], reports: [report("portrait", PORTRAIT)], friendsCount: 0 });

    expect(view.portrait).toBeNull();
  });

  test("a damaged portrait is ignored", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("portrait", { version: 2 })], friendsCount: 0 });

    expect(view.portrait).toBeNull();
  });

  test("waiting for the blocks never keeps the page refreshing", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [report("full", FULL)], friendsCount: 0 });

    expect(view.portrait).toBeNull();
    expect(view.preparing).toBe(false);
  });
});
```

Run: `pnpm vitest run apps/web/src/lib/portrait-report.test.ts apps/web/src/lib/report-view.test.ts`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`apps/web/src/lib/portrait-report.ts`:

```ts
import { parseSections, type PortraitSections } from "@grani/ai";
import type { ReportRecord } from "@grani/db";

// Повреждённый или устаревший отчёт равен отсутствующему: вкладка покажет прежний вид, а не упадёт
export function parsePortraitReport(report: Pick<ReportRecord, "sections"> | null | undefined): PortraitSections | null {
  return report ? parseSections("portrait", report.sections) : null;
}
```

`apps/web/src/lib/report-view.ts`: импорт типа `type PortraitSections` (в существующий импорт из `@grani/ai`), `import { parsePortraitReport } from "./portrait-report";`; в `ReportPageView` после `life` добавить `portrait: PortraitSections | null;`; в `buildReportPageView` после `life` добавить

```ts
  const portrait = unlocked.has("portrait") ? parsePortraitReport(byKind.get("portrait")) : null;
```

и в возвращаемый объект `portrait,`.

- [ ] **Step 3: Починить фикстуры**

Run: `pnpm --filter @grani/web typecheck`. В каждый объект `ReportPageView`, на который укажет компилятор, добавить `portrait: null` (в `PersonalEdition.test.tsx` это `baseView`, в `PersonalEdition.covers.test.tsx` соседний `view`).

Run: `pnpm vitest run apps/web/src/lib apps/web/src/components/personality-atlas && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add apps/web/src/lib apps/web/src/components/personality-atlas
git commit -m "feat(web): expose the portrait blocks in the report page view for the owner of the full report"
```

---

### Task 6: Сайт: общая постановка дополнительных отчётов

**Files:**
- Rename: `apps/web/src/server/life-cards.ts` → `extra-reports.ts`, `life-cards.test.ts` → `extra-reports.test.ts` (`git mv`)
- Modify: `apps/web/src/server/payments-service.ts`, `payments-service.test.ts`, `payments-deps.ts`
- Modify: `apps/web/src/app/report/[resultId]/page.tsx`, `page.test.tsx` (в Task 7 вместе с вкладкой; здесь только то, что нужно, чтобы страница компилировалась)

**Interfaces:**
- Consumes: `EXTRA_KINDS`, `ExtraKind`, `unlockedKinds` (Task 2).
- Produces:
  - `lifeCardsEnabled()`, `portraitEnabled()`, `extraReportFlags(): Readonly<Record<ExtraKind, boolean>>`.
  - `requestExtraReports(deps: { enqueueGenerate: (job: GenerateJob) => Promise<void> }, p: { resultId: string; owned: readonly Product[]; enabled: Readonly<Record<ExtraKind, boolean>>; present: Readonly<Record<ExtraKind, boolean>> }): Promise<ExtraKind[]>` (какие задачи поставлены).
  - `PaymentsDeps.extras?: Readonly<Partial<Record<ExtraKind, boolean>>>` (заменяет `lifeCards`).

- [ ] **Step 1: Падающие тесты**

```bash
git mv apps/web/src/server/life-cards.ts apps/web/src/server/extra-reports.ts
git mv apps/web/src/server/life-cards.test.ts apps/web/src/server/extra-reports.test.ts
```

`apps/web/src/server/extra-reports.test.ts` (заменить содержимое):

```ts
import type { Product } from "@grani/core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { extraReportFlags, lifeCardsEnabled, portraitEnabled, requestExtraReports } from "./extra-reports";

const enqueueGenerate = vi.fn().mockResolvedValue(undefined);
const ALL_ON = { life: true, portrait: true };
const NONE_PRESENT = { life: false, portrait: false };
const ask = (p: Partial<{ enabled: { life: boolean; portrait: boolean }; owned: Product[]; present: { life: boolean; portrait: boolean } }> = {}) =>
  requestExtraReports({ enqueueGenerate }, { resultId: "r1", owned: p.owned ?? ["full"], enabled: p.enabled ?? ALL_ON, present: p.present ?? NONE_PRESENT });

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LIFE_CARDS_V1;
  delete process.env.PORTRAIT_V1;
});

describe("the flags", () => {
  test("each is on only when its variable is 1", () => {
    expect(extraReportFlags()).toEqual({ life: false, portrait: false });
    process.env.LIFE_CARDS_V1 = "1";
    expect(lifeCardsEnabled()).toBe(true);
    expect(portraitEnabled()).toBe(false);
    process.env.PORTRAIT_V1 = "1";
    expect(extraReportFlags()).toEqual({ life: true, portrait: true });
    process.env.PORTRAIT_V1 = "0";
    expect(portraitEnabled()).toBe(false);
  });
});

describe("requestExtraReports", () => {
  test("queues each missing report once for a paid owner", async () => {
    expect(await ask()).toEqual(["life", "portrait"]);
    expect(enqueueGenerate).toHaveBeenCalledTimes(2);
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "life", resultId: "r1" });
    expect(enqueueGenerate).toHaveBeenCalledWith({ kind: "portrait", resultId: "r1" });
  });

  test("skips reports that are ready and reports whose flag is off", async () => {
    expect(await ask({ present: { life: true, portrait: false } })).toEqual(["portrait"]);
    expect(await ask({ enabled: { life: false, portrait: true } })).toEqual(["portrait"]);
    expect(await ask({ enabled: { life: true, portrait: false }, present: { life: true, portrait: false } })).toEqual([]);
  });

  test("does nothing without the full report", async () => {
    expect(await ask({ owned: ["pair"] })).toEqual([]);
    expect(await ask({ owned: [] })).toEqual([]);
    expect(enqueueGenerate).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "portrait" }));
  });
});
```

В `apps/web/src/server/payments-service.test.ts` заменить блок `describe("life cards after payment")`:

```ts
describe("extra reports after payment", () => {
  test("a full purchase also queues the enabled extra reports", async () => {
    deps = { ...deps, extras: { life: true, portrait: true } };

    await buyAndPay("full");

    expect(enqueue).toHaveBeenCalledWith({ kind: "full", resultId: anna.resultId });
    expect(enqueue).toHaveBeenCalledWith({ kind: "life", resultId: anna.resultId });
    expect(enqueue).toHaveBeenCalledWith({ kind: "portrait", resultId: anna.resultId });
  });

  test("each extra report follows its own flag", async () => {
    deps = { ...deps, extras: { portrait: true } };

    await buyAndPay("full");

    expect(enqueue.mock.calls.map(([job]) => job.kind)).toEqual(["full", "portrait"]);
  });

  test("with the flags off no extra job is queued: it would be finished as skipped and block the later one", async () => {
    await buyAndPay("full");

    expect(enqueue.mock.calls.map(([job]) => job.kind)).toEqual(["full"]);
  });

  test("a chapter purchase never queues extra reports", async () => {
    deps = { ...deps, extras: { life: true, portrait: true } };
    await buyAndPay("full");
    enqueue.mockClear();

    await buyAndPay("chapter_money");

    expect(enqueue.mock.calls.map(([job]) => job.kind)).toEqual(["chapter_money"]);
  });

  test("the waiting page does not wait for extra reports and does not requeue them", async () => {
    deps = { ...deps, extras: { life: true, portrait: true } };
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

Run: `pnpm vitest run apps/web/src/server/extra-reports.test.ts apps/web/src/server/payments-service.test.ts`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`apps/web/src/server/extra-reports.ts` (заменить содержимое):

```ts
import { EXTRA_KINDS, unlockedKinds, type ExtraKind, type GenerateJob, type Product } from "@grani/core";

// Флаги включать вместе с одноимёнными флагами воркера (см. deploy/server-setup.md)
export const lifeCardsEnabled = () => process.env.LIFE_CARDS_V1 === "1";
export const portraitEnabled = () => process.env.PORTRAIT_V1 === "1";
export const extraReportFlags = (): Readonly<Record<ExtraKind, boolean>> => ({ life: lifeCardsEnabled(), portrait: portraitEnabled() });

export type ExtraReportsDeps = { enqueueGenerate: (job: GenerateJob) => Promise<void> };

// Уже купившим дополнительные отчёты ставятся при открытии страницы разбора. Id задачи детерминирован
// (`generate:<resultId>:<вид>`), поэтому повторные открытия не плодят дубли
export async function requestExtraReports(
  deps: ExtraReportsDeps,
  p: { resultId: string; owned: readonly Product[]; enabled: Readonly<Record<ExtraKind, boolean>>; present: Readonly<Record<ExtraKind, boolean>> },
): Promise<ExtraKind[]> {
  const unlocked = unlockedKinds(p.owned);
  const queued: ExtraKind[] = [];
  for (const kind of EXTRA_KINDS) {
    if (!p.enabled[kind] || p.present[kind] || !unlocked.has(kind)) continue;
    await deps.enqueueGenerate({ kind, resultId: p.resultId });
    queued.push(kind);
  }
  return queued;
}
```

`apps/web/src/server/payments-service.ts`: импорт `EXTRA_KINDS, type ExtraKind` из `@grani/core`; в `PaymentsDeps` заменить поле `lifeCards?: boolean;` на

```ts
  // Дополнительные отчёты ставятся вместе с полным разбором только при включённом флаге: задача, завершённая как «пропущено», заняла бы id
  extras?: Readonly<Partial<Record<ExtraKind, boolean>>>;
```

в `enqueuePaid` строку `if (deps.lifeCards === true) jobs.push({ kind: "life", resultId: target.resultId });` заменить на

```ts
    for (const kind of EXTRA_KINDS) if (deps.extras?.[kind] === true) jobs.push({ kind, resultId: target.resultId });
```

(комментарий над ней оставить: «Дополнительных отчётов нет в jobsFor: страница оплаты не должна ждать отчёт, у которого есть запасной вариант»).

`apps/web/src/server/payments-deps.ts`: импорт `import { extraReportFlags } from "./extra-reports";` вместо `lifeCardsEnabled` из `./life-cards`; в возвращаемом объекте `lifeCards: lifeCardsEnabled()` заменить на `extras: extraReportFlags()`.

`apps/web/src/app/report/[resultId]/page.tsx`: импорт `import { extraReportFlags, requestExtraReports } from "@/server/extra-reports";` вместо `@/server/life-cards`; вызов заменить на

```tsx
  if (model) await requestExtraReports({ enqueueGenerate }, { resultId, owned, enabled: extraReportFlags(), present: { life: view.life !== null, portrait: view.portrait !== null } });
```

В `page.test.tsx` существующие тесты ленивой постановки продолжают проходить без правок (моки вида без поля `portrait` дают `view.portrait !== null`: портрет считается готовым и не ставится); если какой-то падает, поправить мок: добавить `portrait: null`.

Run: `pnpm vitest run apps/web/src/server apps/web/src/app/report && pnpm --filter @grani/web typecheck`
Expected: PASS. Проверить, что нигде не осталось ссылок на `life-cards` и `lifeCards:`: `grep -rn "life-cards\"\|lifeCards:\|requestLifeCards" apps` должен быть пуст (кроме названия компонента `LifeCards`).

- [ ] **Step 3: Коммит**

```bash
git add apps/web
git commit -m "feat(web): one request path for the extra reports, queued after payment and on first open"
```

---

### Task 7: Сайт: вкладка «Портрет» блоками

**Files:**
- Create: `apps/web/src/components/PortraitBlocks.tsx`, `PortraitBlocks.module.css`, `PortraitBlocks.test.tsx`
- Modify: `apps/web/src/components/personality-atlas/PersonalEdition.tsx`, `PersonalEdition.test.tsx`
- Modify: `apps/web/src/app/report/[resultId]/page.test.tsx`
- Create: `scripts/seed-portrait-report.mjs`

**Interfaces:**
- Consumes: `ReportPageView.portrait` (Task 5), `requestExtraReports` на странице (Task 6), `PortraitSections` (Task 2), `samplePortrait` (Task 3).
- Produces: `<PortraitBlocks sections={PortraitSections} />` (корневой элемент с `id="edition-reading"` и `data-portrait-blocks`).

- [ ] **Step 1: Падающие тесты компонента**

`apps/web/src/components/PortraitBlocks.test.tsx`:

```tsx
import { parsePortrait } from "@grani/ai";
import { samplePortrait } from "@grani/ai/testing";
import { portraitSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PortraitBlocks } from "./PortraitBlocks";

const sections = () => {
  const answer = samplePortrait();
  const built = parsePortrait({ version: 1, headline: answer.headline, blocks: answer.blocks.map((block, index) => ({ ...block, title: portraitSeeds()[index]!.title })) });
  if (!built) throw new Error("fixture is not a valid portrait");
  return built;
};

describe("PortraitBlocks", () => {
  test("shows the headline and five titled blocks, with the reading anchor", () => {
    const html = renderToStaticMarkup(<PortraitBlocks sections={sections()} />);

    expect(html).toContain("data-portrait-blocks");
    expect(html).toContain('id="edition-reading"');
    expect(html).toContain(samplePortrait().headline);
    expect(html.match(/<article/g)).toHaveLength(5);
    for (const seed of portraitSeeds()) expect(html).toContain(seed.title);
    for (const block of samplePortrait().blocks) expect(html).toContain(block.text.slice(0, 40));
  });

  test("escapes the model text", () => {
    const evil = sections();
    const html = renderToStaticMarkup(<PortraitBlocks sections={{ ...evil, headline: `${evil.headline} <script>x</script>` }} />);

    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

Run: `pnpm vitest run apps/web/src/components/PortraitBlocks.test.tsx`
Expected: FAIL (`Cannot find module './PortraitBlocks'`).

- [ ] **Step 2: Компонент**

`apps/web/src/components/PortraitBlocks.tsx`:

```tsx
import type { PortraitSections } from "@grani/ai";
import styles from "./PortraitBlocks.module.css";

// Вкладка «Портрет»: фраза-вывод и пять коротких блоков, написанных под баллы читателя
export function PortraitBlocks({ sections }: { sections: PortraitSections }) {
  return (
    <section className={styles.root} id="edition-reading" data-portrait-blocks aria-labelledby="portrait-headline">
      <p className={styles.label}>Личный портрет</p>
      <h2 id="portrait-headline" className={styles.headline}>
        {sections.headline}
      </h2>
      <div className={styles.grid}>
        {sections.blocks.map((block, index) => (
          <article key={block.seed} className={styles.block}>
            <p className={styles.number}>{String(index + 1).padStart(2, "0")}</p>
            <h3>{block.title}</h3>
            <p>{block.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

`apps/web/src/components/PortraitBlocks.module.css` (функциональная вёрстка на токенах вкладки; красоту доводит Codex):

```css
.root { display: grid; gap: 24px; padding: 40px 0; scroll-margin-top: 110px; overflow-wrap: anywhere; }
.label { margin: 0; font: 600 12px/1.4 var(--font-body), system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold, #d9bc83); }
.headline { margin: 0; max-width: 900px; font: 300 clamp(28px, 4vw, 44px) / 1.2 var(--font-display), Georgia, serif; color: var(--text, #f1ecdf); }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.block { padding: 24px; border: 1px solid var(--line, #496355); border-radius: 6px; background: var(--surface, #102a21); color: var(--text, #f1ecdf); }
.block h3 { margin: 0 0 10px; font: 400 22px/1.3 var(--font-display), Georgia, serif; }
.block p { margin: 0; font-size: 16px; line-height: 1.65; }
.block .number { margin: 0 0 8px; font: 300 32px/1 var(--font-display), Georgia, serif; color: var(--gold, #d9bc83); }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .block { padding: 18px; }
}
```

Run: `pnpm vitest run apps/web/src/components/PortraitBlocks.test.tsx` — Expected: PASS.

- [ ] **Step 3: Падающий тест вкладки**

В `apps/web/src/components/personality-atlas/PersonalEdition.test.tsx` (импорты `parsePortrait` из `@grani/ai`, `samplePortrait` из `@grani/ai/testing`, `portraitSeeds` из `@grani/content` добавить к уже существующим):

```tsx
  test("the portrait tab shows the blocks instead of the paragraph, the scale map and the strengths when the portrait is ready",()=>{
    const answer=samplePortrait();
    const portrait=parsePortrait({version:1,headline:answer.headline,blocks:answer.blocks.map((block,index)=>({...block,title:portraitSeeds()[index]!.title}))})!;
    const withBlocks=renderToStaticMarkup(<PersonalEdition {...props} view={{...baseView,portrait}}/>);
    expect(withBlocks).toContain("data-portrait-blocks");
    expect(withBlocks).toContain(portrait.headline);
    expect(withBlocks).not.toContain("Что связывает");
    expect(withBlocks).not.toContain("Ваши сильные стороны");
    expect(withBlocks).not.toContain('id="atlas-section-2"');
    expect(withBlocks).toContain("Что стоит замечать");
    expect(withBlocks).toContain(full.blind_spots[0]!.tip);
    const without=renderToStaticMarkup(<PersonalEdition {...props}/>);
    expect(without).not.toContain("data-portrait-blocks");
    expect(without).toContain("Что связывает");
    expect(without).toContain("Ваши сильные стороны");
    expect(without).toContain(full.portrait);
  });
```

Run: `pnpm vitest run apps/web/src/components/personality-atlas/PersonalEdition.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Вкладка**

В `PersonalEdition.tsx`: импорт `import { PortraitBlocks } from "@/components/PortraitBlocks";`. В разметке вкладки `edition-portrait` заменить блок `<div className={`${styles.paper} ${styles.portraitPaper}`} id="edition-reading">…</div>` на условный:

```tsx
{view.portrait?<PortraitBlocks sections={view.portrait}/>:<div className={`${styles.paper} ${styles.portraitPaper}`} id="edition-reading">…прежнее содержимое без изменений…</div>}
```

и в блоке `{view.full&&<div className={`${styles.paper} ${styles.resources}`}>…}` вокруг секции «Ваши сильные стороны» поставить условие: `{!view.portrait&&<section id="atlas-section-2">…прежнее…</section>}` (секция «Что стоит замечать», `id="atlas-section-3"`, остаётся всегда).

Run: `pnpm vitest run apps/web/src/components apps/web/src/lib && pnpm --filter @grani/web typecheck`
Expected: PASS.

- [ ] **Step 5: Тест страницы: блоки и постановка**

В `apps/web/src/app/report/[resultId]/page.test.tsx` (импорты `samplePortrait`, `portraitSeeds` по необходимости):

```tsx
test("an existing buyer without the portrait gets the job queued once when the portrait flag is on",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";process.env.PORTRAIT_V1="1";
  mocks.view.mockReturnValue({full,life:null,portrait:null,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null});
  await render();
  expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  expect(mocks.enqueue).toHaveBeenCalledWith({kind:"portrait",resultId:"r"});
  delete process.env.PORTRAIT_V1;
});
test("nothing is queued for the portrait with the flag off or with a ready portrait",async()=>{
  process.env.PERSONALITY_ATLAS_V2="1";
  mocks.view.mockReturnValue({full,life:null,portrait:null,preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null});
  await render();
  process.env.PORTRAIT_V1="1";
  const answer=samplePortrait();
  mocks.view.mockReturnValue({full,life:null,portrait:{version:1,headline:answer.headline,blocks:answer.blocks.map((block,index)=>({...block,title:portraitSeeds()[index]!.title}))},preparing:false,friends:{state:"waiting",counter:"0 из 3"},chapters:[],bundle:null});
  const html=await render();
  expect(html).toContain("data-portrait-blocks");
  expect(mocks.enqueue).not.toHaveBeenCalled();
  delete process.env.PORTRAIT_V1;
});
```

И в `beforeEach` добавить `delete process.env.PORTRAIT_V1;`.

Run: `pnpm vitest run "apps/web/src/app/report/[resultId]/page.test.tsx"`
Expected: PASS (страница уже вызывает `requestExtraReports` из Task 6; если тест падает, причина в `present.portrait`, проверить).

- [ ] **Step 6: Скрипт тестовых данных и проверка глазами**

`scripts/seed-portrait-report.mjs` по образцу `scripts/seed-life-report.mjs` (та же защита «только локальная база», те же аргументы `<resultId> [--remove]`), данные: `{ version: 1, headline, blocks: [5 × { seed, title, text }] }` с темами из Global Constraints и текстами из `samplePortrait()` (скопировать тексты как строки в скрипт), `kind = 'portrait'`.

Запустить локально: `pnpm dev:db` (если порт занят, `DEV_DB_PORT=5434 DEV_DB_DIR=.dev-db-portrait` и `DATABASE_URL` с 5434 в `apps/web/.env.development.local` на время проверки, затем вернуть как было), `PERSONALITY_ATLAS_V2=1 PORTRAIT_V1=1 LIFE_CARDS_V1=1 pnpm dev:web` через `preview_start`, войти `/api/dev/login?name=Paid`, создать результат и оплаченный `full`, вставить тестовые `full` и `portrait`. Проверить вкладку «Портрет»: блоки в две колонки на десктопе и в одну на 390 px, без горизонтальной прокрутки, «Что стоит замечать» ниже, консоль без ошибок, без `portrait` прежний вид.

- [ ] **Step 7: Коммит**

```bash
git add apps/web scripts/seed-portrait-report.mjs
git commit -m "feat(web): the portrait tab shows the model's short blocks, the previous view stays as the fallback"
```

---

### Task 8: Конфигурация, инструкция по выкладке, задание на оформление

**Files:**
- Modify: `deploy/env.example`, `deploy/server-setup.md`
- Create: `docs/redesign/CODEX_PORTRAIT_BLOCKS.md`

- [ ] **Step 1: Конфигурация**

`deploy/env.example`, после строки `#LIFE_CARDS_V1=1`:

```
# Вкладка «Портрет» короткими блоками. Включать вместе с ИИ (yandex/gigachat); у сайта и воркера значение одно
#PORTRAIT_V1=1
```

`deploy/server-setup.md`, после абзаца «Карточки «В жизни»»:

```markdown
**«Портрет» блоками.** `PORTRAIT_V1=1` в `.env`, затем `docker compose up -d --force-recreate web worker` (флаг читают оба контейнера, включать нужно сразу оба). В строке `worker started` должно быть `portraitV1: true`. Проверка: открыть разбор тестового аккаунта, через минуту обновить страницу, на вкладке «Портрет» должны быть фраза-вывод и пять блоков; в логе `docker logs --since 10m grani-worker-1 | grep -iE "chapter part|portrait|report generated"`: `report generated` с `kind: portrait` и `source: ai`. Если в логе `portrait failed`, отчёт не сохранён и вкладка остаётся прежней; повторить можно, удалив завершённую задачу из `pgboss.job` (id `generate:<resultId>:portrait`). Откат: убрать переменную и пересоздать `web` и `worker`: уже созданные блоки продолжат показываться.
```

- [ ] **Step 2: Задание Codex на оформление блоков**

`docs/redesign/CODEX_PORTRAIT_BLOCKS.md`: короткое задание по образцу `docs/redesign/CODEX_LIFE_CARDS.md`:
- Контекст: вкладка «Портрет» теперь показывает фразу-вывод и пять блоков (`apps/web/src/components/PortraitBlocks.tsx`, стили `PortraitBlocks.module.css`); логику не менять.
- Что сделать: довести вид до уровня ночного стиля («Личный разбор: ночной дизайн», PR 146): крупная фраза-вывод как главный акцент, блоки с номером и заголовком в общем масштабе, при желании маленький значок или линия у блока; новых картинок без согласования не рисовать.
- Границы: только CSS (и, если необходимо, оформление в JSX `PortraitBlocks`), тексты и идентификаторы не менять (`edition-reading`, `data-portrait-blocks`), тесты проходят.
- Как смотреть: `scripts/seed-portrait-report.mjs <resultId>` кладёт тестовый отчёт; остальное как в `docs/redesign/CODEX_REPORT_VISUAL.md`.
- Результат: PR в `master`, слияние не делать; снимки на 1280, 768, 390, 320.

- [ ] **Step 3: Коммит**

```bash
git add deploy docs/redesign/CODEX_PORTRAIT_BLOCKS.md
git commit -m "docs: rollout steps for PORTRAIT_V1 and the visual brief for the portrait blocks"
```

---

### Task 9: Финальная проверка и PR

- [ ] **Step 1: Полные проверки**

Run: `pnpm test` и `pnpm typecheck`. Если `practice-upgrade` или `personality-atlas-upgrade` упали по таймауту, запустить их отдельно. Если `pnpm` начинает переустановку зависимостей и падает на удалении файлов, не запускать её повторно слепо: остановить процессы проекта и выполнить `pnpm install --frozen-lockfile`.

- [ ] **Step 2: Один разбор всей ветки**

Прочитать `git diff <база ветки>...HEAD` по Global Constraints и Review Focus этого плана; `grep -rn "Record<ReportKind\|Exclude<ReportKind" apps packages` (все исключения идут через `ExtraKind`); нет `console.log` вне CLI-скриптов; в логах нет текстов ответа модели; функции короче 50 строк. Найденное исправить отдельными коммитами.

- [ ] **Step 3: Открыть PR (слияние не делать)**

```bash
git push -u origin feat/portrait-blocks
gh pr create --base master --title "feat: portrait tab in short blocks without free-result repeats" --body-file <файл с описанием>
```

В описании: что сделано по задачам; как включать (`PORTRAIT_V1=1` у сайта и воркера одновременно, `deploy/server-setup.md`); снимки вкладки; раздел **«Не проверено»**: живая генерация YandexGPT (качество блоков, частота отказа проверки на пересказ и расход попыток), миграция на боевой БД, оформление блоков (доводит Codex), другие ширины и темы. После открытия PR по правилам приложения: `get_status`, при необходимости `bind_pr`, прочитать проверки CI.

- [ ] **Step 4: Ждать команды «вливай»**

В `master` не вливать. После команды: дождаться зелёных проверок PR, влить, дождаться зелёного `deploy`. Включение флага на сервере владелец делает по готовым однострочным командам, по одной (как для `LIFE_CARDS_V1`).

---

## Самопроверка плана

**Покрытие спецификации**

| Требование | Задача |
|---|---|
| Новый вид `portrait`, доступ с `full`, не продукт | 2, 6 |
| Миграция enum отдельным коммитом | 2 |
| Формат `{version, headline, blocks[5]}`, заголовки из тем | 1, 2, 3 |
| Пять тем, черты, разделы библиотеки | 1 |
| Один запрос, пять попыток, стиль/род/замечания/мягкая последняя | 3 |
| Проверка на пересказ бесплатного, бесплатные тексты не в запросе | 3 |
| Нет ИИ / неудача → не сохраняется; флаг `PORTRAIT_V1` | 4, 6 |
| Постановка после оплаты и при открытии страницы, общий механизм с `life` | 6 |
| Вкладка: блоки вместо абзаца, карты шкал и сильных сторон; прежний вид без отчёта | 5, 7 |
| «Что стоит замечать» остаётся | 7 |
| Нет уведомлений, нет в «4 сферы», `jobsFor`, страница ожидания | 2, 4, 6 |
| Оформление блоков доводит Codex | 8 |
| Выкладка и откат | 8, 9 |

**Сканирование на пустые места:** шагов «позже» нет. Единственное осознанно открытое: тексты образцов в `samplePortrait` и пороги проверок подгоняются по результатам тестов (фиксируется в журнале решений), а оформление блоков отдано Codex.

**Согласованность имён:** `portraitSeeds`, `PORTRAIT_SECTIONS` (Task 1) → `portrait-cards.ts` (Task 3); `PortraitSchema`, `PortraitModelSchema`, `PortraitSections`, `parsePortrait`, `PORTRAIT_BLOCKS` (Task 2) → Tasks 3, 5, 7; `EXTRA_KINDS`, `ExtraKind`, `isExtraKind` (Task 2) → Tasks 4, 6; `generatePortrait`, `portraitStubWriter`, `samplePortrait` (Task 3) → Tasks 4, 5, 7; `runPrompt` (Task 3) → `generate-portrait.ts`; `parsePortraitReport`, `ReportPageView.portrait` (Task 5) → Task 7; `requestExtraReports`, `extraReportFlags`, `PaymentsDeps.extras` (Task 6) → Task 7; `WorkerEnv.portraitV1` ↔ `GenerateDeps.portraitV1` (Task 4).
