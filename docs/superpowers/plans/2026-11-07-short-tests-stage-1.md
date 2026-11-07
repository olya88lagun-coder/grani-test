# Короткие тесты, этап 1: основа + бесплатный тест на тип привязанности — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница `/privyazannost`: тест на тип привязанности проходится и показывает результат без входа и без сервера; страница индексируется и ведёт в Big Five. Плюс 4 страницы типов.

**Architecture:** Тест — данные в `@grani/content` (`short-tests/*`), подсчёт — чистая функция в `@grani/core` (`short-tests.ts`). Клиентский раннер переиспользует существующий `Questionnaire`, считает результат в браузере и хранит его в `localStorage`. На этапе 1 нет таблиц, входа и оплаты: они появятся на этапах 2–3 по отдельным планам.

**Tech Stack:** Next.js App Router (server components + один client component), TypeScript, vitest (unit), Playwright (e2e), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-11-07-short-tests-attachment-temperament-design.md`

## Global Constraints

- Результат показывается без входа; ничего из ответов не уходит на сервер (кроме названия шага воронки в `/api/funnel`).
- Адреса не начинаются с `/test` — в `robots.txt` стоит `Disallow: /test`. Адреса: `/privyazannost`, `/privyazannost/[slug типа]`.
- Ось и тип: оси `anxiety` (тревожность) и `avoidance` (избегание), 0–100 %. Граница типа — 50 %: `secure` (обе < 50), `anxious` (тревожность ≥ 50, избегание < 50), `avoidant` (избегание ≥ 50, тревожность < 50), `fearful` (обе ≥ 50). Ось в 45–55 % помечается как «смешанная».
- Шкала ответов 1–5 (тип `Answer` из `@grani/core`), подписи ответов — существующие `ANSWER_LABELS`.
- Около 30 утверждений: ровно 15 на ось, на каждой оси 6–9 обратных. Формулировки свои (не текст ECR/ECR-R), про близкие отношения в целом.
- Все тексты пишет исполнитель: бережно, без диагнозов; каждый текст проходит `findStopWords` из `@grani/content` без совпадений. Фраза «Это описание поведения в отношениях, а не диагноз» есть на странице и в результате.
- Методика с источниками: Brennan, Clark, Shaver 1998; Fraley, Waller, Brennan 2000.
- Платные кнопки и «позвать партнёра» на этом этапе не показываются.

## Review Focus

1. Человек обновил страницу посреди теста — ответы восстанавливаются (Questionnaire уже хранит прогресс по `storageKey`), после последнего ответа результат показывается, а не теряется.
2. `localStorage` недоступен (приватный режим, запрет) — тест проходится и результат показывается, только не сохраняется. Тест: e2e с заблокированным `localStorage` (Task 4).
3. Сохранённый результат повреждён или от старой версии теста — страница показывает тест заново, а не падает. Тест: `parseStoredShortResult` в Task 4.
4. Человек ответил «Когда как» (3) на всё — обе оси 50 %, тип определяется детерминированно (`fearful` по правилу ≥ 50) и обе оси помечены смешанными. Тест: Task 1.
5. Ответы с неизвестными id или значениями вне 1–5 (подделанный `localStorage`) — подсчёт бросает ошибку, раннер ловит её и показывает тест заново. Тест: Task 1 и Task 4.

---

### Task 1: Подсчёт коротких тестов в core

**Files:**
- Create: `packages/core/src/short-tests.ts`
- Create: `packages/core/src/short-tests.test.ts`
- Modify: `packages/core/src/index.ts` (добавить `export * from "./short-tests";`)

**Interfaces:**
- Produces:
  ```ts
  export type ShortTestItemKey = { id: string; axis: string; reverse: boolean };
  export type ShortTestTypeRule = { key: string; when: Readonly<Record<string, "low" | "high">> };
  export type ShortTestScoring = {
    axes: readonly string[];
    items: readonly ShortTestItemKey[];
    types: readonly ShortTestTypeRule[];   // ровно одно правило должно подходить к любым баллам
    threshold: number;                     // 50
    mixedBand: readonly [number, number];  // [45, 55]
  };
  export type ShortTestScore = {
    axes: Readonly<Record<string, number>>; // 0–100, целые
    typeKey: string;
    mixedAxes: readonly string[];
  };
  export function scoreShortTest(scoring: ShortTestScoring, answers: Answers): ShortTestScore;
  export function isShortTestComplete(scoring: ShortTestScoring, answers: Answers): boolean;
  ```
  Ось «high», если балл ≥ `threshold`. Балл оси = среднее по её утверждениям (обратные: `6 - answer`), переведённое `(mean - 1) / 4 * 100` и округлённое.

- [ ] **Step 1: Write the failing tests** в `short-tests.test.ts` на маленьком фикстурном `scoring` (2 оси по 2 утверждения, одно обратное, 4 правила типа как у привязанности):
  - `all max on direct, min on reverse → axis 100`: ответы 5 на прямое и 1 на обратное → `axes.a === 100`.
  - `all 3 → both axes 50, type of both-high rule, both mixed`: `axes` = `{a: 50, b: 50}`, `typeKey === "fearful"`, `mixedAxes` = `["a","b"]`.
  - `low/high quadrants map to the four types`: 4 набора ответов → `secure`, `anxious`, `avoidant`, `fearful`.
  - `throws on missing answer`: `expect(() => scoreShortTest(s, partial)).toThrow()`.
  - `throws on unknown item id and on value outside 1–5`.
  - `throws when no type rule or more than one rule matches` (фикстура с дырой в правилах).
  - `isShortTestComplete` — `false` при пропуске, `true` при полном наборе.

- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/short-tests.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `scoreShortTest` и `isShortTestComplete` в `packages/core/src/short-tests.ts` по интерфейсу выше; экспорт из `index.ts`.

- [ ] **Step 4: Run** `pnpm vitest run packages/core/src/short-tests.test.ts` и `pnpm --filter @grani/core typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(core): scoring for short tests`.

### Task 2: Контент теста на тип привязанности

**Files:**
- Create: `packages/content/src/short-tests/types.ts` — тип описания теста
- Create: `packages/content/src/short-tests/attachment.ts` — сам тест
- Create: `packages/content/src/short-tests/index.ts` — реестр
- Create: `packages/content/src/short-tests/short-tests.test.ts`
- Modify: `packages/content/package.json` — экспорт `"./short-tests": "./src/short-tests/index.ts"`

**Interfaces:**
- Consumes: `ShortTestScoring` из Task 1.
- Produces:
  ```ts
  export type ShortTestType = {
    key: string; slug: string;            // slug для /privyazannost/[slug]
    name: string;                          // «Надёжный тип привязанности»
    tagline: string;                       // одна строка
    summary: string;                       // 3–4 предложения для бесплатного результата
    page: { title: string; description: string; sections: readonly { heading: string; text: string }[] }; // страница типа, ≥ 400 слов
  };
  export type ShortTestAxisInfo = { key: string; label: string; low: string; high: string; mixed: string };
  export type ShortTestDefinition = {
    slug: string;                          // "attachment"
    path: string;                          // "/privyazannost"
    title: string; description: string; h1: string;
    brief: string;                         // блок «Кратко», 2–3 предложения
    intro: string;                         // инструкция перед первым вопросом
    items: readonly { id: string; text: string }[];
    scoring: ShortTestScoring;
    axes: readonly ShortTestAxisInfo[];
    types: readonly ShortTestType[];
    sections: readonly { heading: string; text: string }[]; // серверный SEO-текст страницы
    faq: readonly { question: string; answer: string }[];
    sources: readonly string[];
    disclaimer: string;                    // «Это описание поведения в отношениях, а не диагноз…»
  };
  export const SHORT_TESTS: readonly ShortTestDefinition[];
  export function getShortTest(slug: string): ShortTestDefinition | null;
  export function shortTestTypeBySlug(test: ShortTestDefinition, slug: string): ShortTestType | null;
  ```
  Ключи типов: `secure`, `anxious`, `avoidant`, `fearful`; slug-и страниц: `nadezhnyy`, `trevozhnyy`, `izbegayushchiy`, `trevozhno-izbegayushchiy`.

- [ ] **Step 1: Write the failing tests** в `short-tests.test.ts` для каждого теста из `SHORT_TESTS`:
  - id утверждений уникальны и совпадают с `scoring.items` один к одному.
  - у привязанности ровно 30 утверждений, по 15 на ось, на каждой оси от 6 до 9 `reverse: true`.
  - каждое `scoring.types[].key` есть в `types`, и наоборот; slug-и типов уникальны.
  - для всех 4 квадрантов (`scoreShortTest` на синтетических ответах) находится тип.
  - `findStopWords` пуст для всех текстов теста (утверждения, описания, страницы, FAQ, disclaimer).
  - `page` каждого типа ≥ 400 слов, `sections` страницы теста ≥ 600 слов, `faq` ≥ 5 вопросов.
  - `path` не начинается с `/test`.
  - `getShortTest("attachment")` возвращает тест, `getShortTest("nope")` — `null`.

- [ ] **Step 2: Run** `pnpm vitest run packages/content/src/short-tests` — Expected: FAIL.

- [ ] **Step 3: Write the content and registry.** Тексты пишет исполнитель по Global Constraints. Утверждения — жизненные ситуации («Ответ пришёл сухой и короткий — …» — стиль, не дословно). Title: «Тест на тип привязанности — бесплатно, с диаграммой, без регистрации». Описание ≤ 160 символов.

- [ ] **Step 4: Run** тесты Task 2 и `pnpm --filter @grani/content typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(content): attachment style short test`.

### Task 3: Шаги воронки для коротких тестов

**Files:**
- Modify: `packages/core/src/funnel.ts` — добавить `"attachment_start"`, `"attachment_finish"` в `FUNNEL_STEPS`
- Modify: `apps/web/src/lib/analytics.ts` — те же значения в `GOALS`
- Modify: `packages/core/src/funnel.test.ts` (если нет — `funnel.ts` покрыть в существующем тесте `analytics.test.ts`)

**Interfaces:**
- Produces: `Goal` включает `"attachment_start" | "attachment_finish"`; `isFunnelStep("attachment_finish") === true`.

- [ ] **Step 1: Write the failing test**: `isFunnelStep("attachment_start")` и `("attachment_finish")` → `true`; `reachGoal("attachment_finish")` вызывает `sendBeacon("/api/funnel", "attachment_finish")` (по образцу `analytics.test.ts:183`).
- [ ] **Step 2: Run** `pnpm vitest run packages/core apps/web/src/lib/analytics.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — дописать значения в оба списка.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(analytics): funnel steps for attachment test`.

### Task 4: Раннер теста и экран результата

**Files:**
- Modify: `apps/web/src/components/Questionnaire.tsx` — второй режим завершения
- Create: `apps/web/src/lib/short-test-result.ts` — хранение и вид результата (чистые функции)
- Create: `apps/web/src/lib/short-test-result.test.ts`
- Create: `apps/web/src/components/short-tests/ShortTestRunner.tsx` (client)
- Create: `apps/web/src/components/short-tests/ShortTestResult.tsx`
- Create: `apps/web/src/components/short-tests/AxisMap.tsx` — SVG-карта 2×2 с точкой
- Create: `apps/web/src/components/short-tests/short-tests.module.css`
- Create: `e2e/short-test-attachment.spec.ts`

**Interfaces:**
- Consumes: `scoreShortTest`, `isShortTestComplete` (Task 1); `ShortTestDefinition` (Task 2); `Goal` (Task 3).
- Produces:
  ```ts
  // Questionnaire: ровно одно из двух
  type QuestionnaireProps = Base & ({ submitUrl: string; onComplete?: never } | { onComplete: (answers: Answers) => void; submitUrl?: never });

  // short-test-result.ts
  export const SHORT_RESULT_VERSION = 1;
  export type StoredShortResult = { v: 1; slug: string; answers: Answers; at: string };
  export function shortResultStorageKey(slug: string): string;            // "grani:short:<slug>:result"
  export function serializeShortResult(slug: string, answers: Answers, at: Date): string;
  export function parseStoredShortResult(raw: string | null, test: ShortTestDefinition): ShortTestScore | null; // null при любой порче, чужом slug, другой версии, неполных ответах
  export type ShortResultView = { type: ShortTestType; axes: { info: ShortTestAxisInfo; value: number; mixed: boolean; text: string }[] };
  export function shortResultView(test: ShortTestDefinition, score: ShortTestScore): ShortResultView;

  // компоненты
  export function ShortTestRunner(props: { slug: string }): JSX.Element; // берёт тест через getShortTest(slug)
  export function ShortTestResult(props: { test: ShortTestDefinition; view: ShortResultView; onRestart: () => void }): JSX.Element;
  export function AxisMap(props: { xLabel: string; yLabel: string; x: number; y: number; quadrantLabels: readonly [string, string, string, string] }): JSX.Element;
  ```
  Раннер передаёт в `ShortTestRunner` только `slug` (функции в client component из server не передаются). В Questionnaire `onComplete` вызывается вместо `fetch(submitUrl)`; `storageKey` прогресса — `grani:short:<slug>:progress`; `startGoal="attachment_start"`, `finishGoal="attachment_finish"`, `trackProgress={false}`.

- [ ] **Step 1: Write the failing unit tests** в `short-test-result.test.ts`:
  - `serializeShortResult` → `parseStoredShortResult` возвращает тот же `ShortTestScore`, что `scoreShortTest` на тех же ответах.
  - `parseStoredShortResult` → `null` для: `null`, `"не json"`, `{v: 2,…}`, чужого `slug`, неполных ответов, ответа `7`, неизвестного id.
  - `shortResultView`: тип совпадает с `score.typeKey`; ось с 50 % имеет `mixed: true` и `text === info.mixed`; ось 80 % — `text === info.high`.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/lib/short-test-result.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `short-test-result.ts`; все обращения к `localStorage` в раннере — в `try/catch` (как `readStorage` в Questionnaire).
- [ ] **Step 4: Run** unit-тесты — Expected: PASS.
- [ ] **Step 5: Implement** `Questionnaire` (второй режим), `ShortTestRunner`, `ShortTestResult`, `AxisMap`. Результат содержит: название типа, `tagline`, `AxisMap` (ось X — избегание, ось Y — тревожность), проценты по осям с текстами, `summary`, `disclaimer`, кнопку «Пройти заново», ссылки «Почему у вас так — тест Big Five» (`/big-five-test`) и на страницу своего типа. При загрузке раннер сначала читает сохранённый результат; если он валиден — сразу показывает результат.
- [ ] **Step 6: Write e2e** `e2e/short-test-attachment.spec.ts` (по образцу `e2e/test-flow.spec.ts`):
  - проходит все 30 вопросов ответом «Это про меня» → видит название типа и проценты, запрос `POST /api/funnel` с `attachment_finish` ушёл, других запросов с ответами нет;
  - перезагрузка → результат на месте; «Пройти заново» → первый вопрос;
  - `localStorage` заблокирован (`page.addInitScript` с throw в `Storage.prototype.getItem/setItem`) → тест проходится, результат показывается;
  - в `localStorage` записан мусор под ключом результата → показывается тест, без ошибок в консоли.
- [ ] **Step 7: Run** `pnpm test:e2e -- short-test-attachment` — Expected: PASS.
- [ ] **Step 8: Commit** `feat(web): short test runner and result view`.

### Task 5: Страница `/privyazannost` и страницы типов, SEO

**Files:**
- Create: `apps/web/src/app/privyazannost/page.tsx`
- Create: `apps/web/src/app/privyazannost/[type]/page.tsx`
- Create: `apps/web/src/app/privyazannost/privyazannost.module.css`
- Modify: `apps/web/src/lib/seo.ts` — `PUBLIC_PATHS()` + адреса тестов и типов; `llmsTxt()` — строка про тест
- Modify: `apps/web/src/lib/seo.test.ts`
- Modify: `e2e/short-test-attachment.spec.ts` — проверки страницы

**Interfaces:**
- Consumes: `getShortTest`, `shortTestTypeBySlug`, `SHORT_TESTS` (Task 2); `ShortTestRunner` (Task 4); `publicMetadata`, `faqJsonLd`, `webPageJsonLd`, `breadcrumbs`, `Breadcrumbs`, `JsonLd`, `SourceList` (существующие).
- Produces: `shortTestPaths(): string[]` в `seo.ts` — `["/privyazannost", "/privyazannost/nadezhnyy", …]`.

- [ ] **Step 1: Write the failing tests** в `seo.test.ts`: `PUBLIC_PATHS()` содержит `/privyazannost` и 4 адреса типов; ни один адрес из `shortTestPaths()` не начинается с `/test`; `llmsTxt()` содержит `/privyazannost`.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/lib/seo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `shortTestPaths()` и добавление в `PUBLIC_PATHS()`, `llmsTxt()`.
- [ ] **Step 4: Implement** страницу теста (server component): `metadata` через `publicMetadata`; хлебные крошки; H1; блок «Кратко» (`brief`); `ShortTestRunner slug="attachment"`; ниже серверный текст `sections`, карточки 4 типов со ссылками на их страницы, «Методика» с `SourceList`, FAQ + `faqJsonLd`, `webPageJsonLd`, `disclaimer`; ссылки на `/big-five-test` и `/compatibility`.
- [ ] **Step 5: Implement** страницу типа: `generateStaticParams` по 4 типам, `notFound()` для неизвестного slug, `metadata` из `type.page`, H1 = `type.name`, `sections`, кнопка «Пройти тест» → `/privyazannost`, ссылки на остальные 3 типа, хлебные крошки.
- [ ] **Step 6: Extend e2e**: у `/privyazannost` один H1, `<title>` и `description` из контента, `meta robots` = `index, follow`, есть JSON-LD `FAQPage`; `/privyazannost/nadezhnyy` отдаёт 200, `/privyazannost/nope` — 404; текст `sections` виден без JS (`javaScriptEnabled: false` → в HTML есть первый heading).
- [ ] **Step 7: Run** `pnpm vitest run apps/web` и `pnpm test:e2e -- short-test-attachment` и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 8: Commit** `feat(web): attachment test page and type pages`.

### Task 6: Входящие ссылки

**Files:**
- Modify: `apps/web/src/app/compatibility/page.tsx` — блок-ссылка «Тест на тип привязанности»
- Modify: `packages/content/articles/big-five-v-otnosheniyah.md`, `packages/content/articles/sovmestimost-tipov.md` — по одному абзацу со ссылкой на `/privyazannost` (в теле, где речь о реакциях в отношениях)
- Test: существующий `apps/web/src/lib/articles-integrity.test.ts` (проверяет, что внутренние ссылки ведут на `PUBLIC_PATHS`)

- [ ] **Step 1: Add** ссылки; формулировки без стоп-слов.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/lib/articles-integrity.test.ts packages/content` — Expected: PASS (ссылка на `/privyazannost` разрешена после Task 5).
- [ ] **Step 3: Commit** `feat(content): link to attachment test from pair pages`.

### Task 7: Финальная проверка ветки

- [ ] **Step 1: Run** `pnpm test`, `pnpm typecheck`, `pnpm test:e2e` — Expected: всё зелёное, покрытие не ниже порогов из `vitest.config.ts` (80 %).
- [ ] **Step 2: Manual check** в `pnpm dev:web`: пройти тест на телефонной ширине 375 px — нет горизонтальной прокрутки, карта читается в светлой и тёмной теме.
- [ ] **Step 3: Commit** при необходимости правок; открыть PR из `feat/short-tests` в `master`.

---

**Следующие планы** (пишутся после выпуска этапа 1): этап 2 — таблицы, вход, режим пары, карта пары, `/privyazannost/sochetaniya`, согласия; этап 3 — платные разборы и продукты; этап 4 — темперамент, бонус в Big Five, перелинковка `/articles/temperament`.
