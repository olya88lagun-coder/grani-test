# Тест на темперамент — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бесплатный тест на темперамент на `/temperament` (+4 страницы темпераментов) на основе коротких тестов из этапа 1; строка «Ваш темперамент» в результате Big Five; статья `/articles/temperament` ведёт на тест.

**Architecture:** Новый тест — данные в `@grani/content/short-tests`, подсчёт — существующий `scoreShortTest`. Страницы `/privyazannost` выносятся в общие server-компоненты `ShortTestPage` / `ShortTestTypePage`, чтобы `/temperament` не копировал код. Бонус в Big Five — чистая функция в `@grani/core`.

**Tech Stack:** Next.js App Router, TypeScript, vitest, Playwright, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-11-07-short-tests-attachment-temperament-design.md` (раздел «Темперамент», этап 4). Ветка `feat/temperament-test` от `feat/short-tests` (PR #179 ещё не слит).

## Global Constraints

- Тест бесплатный, без входа, без сервера; без платного разбора и без режима пары.
- Около 24 утверждений: ровно 12 на ось, на каждой оси 4–7 обратных. Формулировки свои (не EPI Айзенка, не опросник Белова).
- Оси: `emotionality` (эмоциональность — обратная сторона эмоциональной устойчивости Big Five) и `extraversion`. Порог 50 %, смешанная зона 45–55 %. Порядок осей в описании — `["emotionality", "extraversion"]`: результат рисует первую ось по вертикали, вторую по горизонтали.
- Темпераменты по квадрантам Айзенка: `sanguine` (экстраверсия ≥ 50, эмоциональность < 50), `choleric` (обе ≥ 50), `phlegmatic` (обе < 50), `melancholic` (эмоциональность ≥ 50, экстраверсия < 50). Slug-и страниц: `sangvinik`, `kholerik`, `flegmatik`, `melankholik`.
- Адреса: `/temperament`, `/temperament/[slug]` — не под `/test` (robots `Disallow: /test`).
- Title ≤ 57 знаков (layout дописывает « — Грани»), description ≤ 160.
- Тексты пишет исполнитель: бережно, без диагнозов, без стоп-слов `findStopWords`; дисклеймер «не диагноз».
- Визуал — за Codex: интерфейс только рабочий минимум (один H1, без горизонтальной прокрутки на 375 px), визуальная доводка в PR передаётся Codex.

## Review Focus

1. Статья `/articles/temperament` и тест `/temperament` не должны конкурировать: у статьи заметная ссылка на тест в начале, у теста — ссылка на статью. Тест: Task 4.
2. Пользователь Big Five с баллами ровно 50 по экстраверсии и стабильности — темперамент определяется детерминированно и совпадает с тем, что дал бы тест на тех же полюсах (стабильность 50 → эмоциональность 50 → «высокая»). Тест: Task 3.
3. Рефакторинг страниц привязанности в общие компоненты не меняет их разметку: те же H1, JSON-LD, адреса, 404 для неизвестного типа. Тест: существующий `e2e/short-test-attachment.spec.ts` целиком (Task 2).
4. Воронка: `temperament_*` в админке считаются от своего старта, а не от Big Five. Тест: `funnelBase` (Task 1).
5. Сохранённый результат привязанности не открывается на странице темперамента и наоборот (ключи по slug). Тест: e2e в Task 2.

---

### Task 1: Контент теста темперамента и шаги воронки

**Files:**
- Create: `packages/content/src/short-tests/temperament.ts`
- Modify: `packages/content/src/short-tests/index.ts` — `SHORT_TESTS = [ATTACHMENT_TEST, TEMPERAMENT_TEST]`
- Modify: `packages/content/src/short-tests/short-tests.test.ts` — блок `describe("temperament test")`
- Modify: `packages/core/src/funnel.ts`, `packages/core/src/funnel.test.ts`, `packages/db/src/funnel.test.ts`, `apps/web/src/lib/analytics.ts`, `apps/web/src/lib/analytics.test.ts`, `apps/web/src/app/admin/funnel/page.tsx`
- Modify: `apps/web/src/components/short-tests/ShortTestRunner.tsx` — `GOALS.temperament`
- Modify: `apps/web/src/lib/seo.test.ts` — ожидание `shortTestPaths()` + 5 адресов темперамента (тест в `SHORT_TESTS` сразу меняет список)

**Interfaces:**
- Consumes: `ShortTestDefinition` (этап 1), `funnelBase`.
- Produces: `TEMPERAMENT_TEST: ShortTestDefinition` (`slug: "temperament"`, `path: "/temperament"`); шаги `temperament_start`, `temperament_finish`; `funnelBase("temperament_finish") === "temperament_start"`.

- [ ] **Step 1: Write the failing tests:** в `short-tests.test.ts` — `describe("temperament test")`: 24 утверждения, по 12 на ось `emotionality`/`extraversion`, на каждой оси 4–7 обратных; `shortTestTypeBySlug(t, "kholerik")?.key === "choleric"`, `"melankholik"` → `melancholic`. Общий `describe.each` по `SHORT_TESTS` автоматически проверит стоп-слова, длину страниц (тип ≥ 400 слов, страница теста ≥ 600), FAQ ≥ 5, title/description. В `funnel.test.ts`: `funnelBase("temperament_finish") === "temperament_start"`, `funnelBase("temperament_start") === null`. В `seo.test.ts`: `shortTestPaths()` равен 5 адресам привязанности + `["/temperament", "/temperament/sangvinik", "/temperament/kholerik", "/temperament/flegmatik", "/temperament/melankholik"]`. В `analytics.test.ts`: `GOALS` заканчивается на `"temperament_start", "temperament_finish"`; `reachGoal("temperament_finish")` шлёт beacon.
- [ ] **Step 2: Run** `pnpm vitest run packages/content/src/short-tests packages/core/src/funnel.test.ts apps/web/src/lib/analytics.test.ts apps/web/src/lib/seo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** контент (тексты: интро, утверждения, 2 оси, 4 темперамента со страницами, разделы страницы, FAQ, источники — Eysenck H. J., Eysenck S. B. G. 1975; Павлов И. П. о типах нервной системы; Costa & McCrae 1992 о связи с Big Five), шаги воронки во всех списках, подписи в админке, `GOALS.temperament` в раннере, строку `temperament_*` в ожидании `packages/db/src/funnel.test.ts`.
- [ ] **Step 4: Run** `pnpm vitest run packages/content packages/core packages/db/src/funnel.test.ts apps/web/src/lib` и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): temperament short test`.

### Task 2: Общие страницы коротких тестов и `/temperament`

**Files:**
- Create: `apps/web/src/components/short-tests/ShortTestPage.tsx` — server component всей страницы теста
- Create: `apps/web/src/components/short-tests/ShortTestTypePage.tsx` — server component страницы типа + `shortTestTypeMetadata`
- Move: `apps/web/src/app/privyazannost/privyazannost.module.css` → `apps/web/src/components/short-tests/short-test-page.module.css`
- Modify: `apps/web/src/app/privyazannost/page.tsx`, `apps/web/src/app/privyazannost/[type]/page.tsx` — тонкие обёртки
- Create: `apps/web/src/app/temperament/page.tsx`, `apps/web/src/app/temperament/[type]/page.tsx`
- Create: `e2e/short-test-temperament.spec.ts`

**Interfaces:**
- Consumes: `getShortTest`, `shortTestTypeBySlug`, `ShortTestRunner` (этап 1).
- Produces:
  ```ts
  export function ShortTestPage(props: { slug: string; related: readonly { href: string; label: string; text: string }[] }): JSX.Element;
  export function shortTestPageMetadata(slug: string): Metadata;
  export function ShortTestTypePage(props: { slug: string; typeSlug: string }): JSX.Element; // notFound() для неизвестного типа
  export function shortTestTypeMetadata(slug: string, typeSlug: string): Metadata;
  export function shortTestTypeParams(slug: string): { type: string }[];
  ```
  `related` — блок «Что ещё пройти» внизу страницы (у привязанности: Big Five и совместимость; у темперамента: Big Five, привязанность и статья `/articles/temperament`). Палитра страницы: привязанность — `pair`, темперамент — без `data-palette` (палитра по умолчанию); поле `palette?: string` в `ShortTestPage`.

- [ ] **Step 1: Write the failing test** `e2e/short-test-temperament.spec.ts`: проходит 24 вопроса → результат с названием темперамента; перезагрузка → результат на месте; один H1, `FAQPage` JSON-LD; `/temperament/kholerik` → 200, `/temperament/nope` → 404; результат привязанности в `localStorage` не показывается на `/temperament` (видна первая карточка вопроса); нет горизонтальной прокрутки на 375 px.
- [ ] **Step 2: Run** `npx playwright test -c e2e/playwright.config.ts short-test-temperament` — Expected: FAIL (404 на `/temperament`).
- [ ] **Step 3: Implement** общие компоненты, перевести `/privyazannost` на них, добавить `/temperament`.
- [ ] **Step 4: Run** `npx playwright test -c e2e/playwright.config.ts short-test-attachment short-test-temperament`, `pnpm vitest run apps/web/src/lib`, `pnpm typecheck` — Expected: PASS (e2e привязанности без изменений — это проверка рефакторинга).
- [ ] **Step 5: Commit** `feat(web): temperament test pages on shared short test page`.

### Task 3: Темперамент в результате Big Five

**Files:**
- Create: `packages/core/src/temperament.ts`, `packages/core/src/temperament.test.ts`; export из `packages/core/src/index.ts`
- Modify: `apps/web/src/lib/result-view.ts` (+ его тест) — поле `temperament`
- Modify: `apps/web/src/app/result/[id]/page.tsx` — строка со ссылкой

**Interfaces:**
- Produces:
  ```ts
  export type TemperamentKey = "sanguine" | "choleric" | "phlegmatic" | "melancholic";
  export function temperamentFromBigFive(scores: TraitScores): TemperamentKey;
  // ResultView
  temperament: { name: string; path: string }; // name из TEMPERAMENT_TEST.types, path — страница темперамента
  ```
  Эмоциональность = `100 - scores.stability`; «высокая» при ≥ 50, экстраверсия «высокая» при ≥ 50 — те же правила, что у теста.

- [ ] **Step 1: Write the failing tests:** `temperamentFromBigFive` для 4 квадрантов (E 80/S 80 → sanguine; E 80/S 20 → choleric; E 20/S 80 → phlegmatic; E 20/S 20 → melancholic); E 50/S 50 → `choleric` (эмоциональность 50 считается высокой). В тесте result-view: `buildResultView(...).temperament` → `{ name: "Сангвиник", path: "/temperament/sangvinik" }` для соответствующих баллов.
- [ ] **Step 2: Run** `pnpm vitest run packages/core/src/temperament.test.ts apps/web/src/lib/result-view.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; на странице результата под тегами — `<p>` «Темперамент: <a href={path}>{name}</a> — <a href="/temperament">пройти тест на темперамент</a>».
- [ ] **Step 4: Run** те же тесты и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): temperament line in Big Five result`.

### Task 4: Статья `/articles/temperament` ведёт на тест

**Files:**
- Modify: `packages/content/articles/temperament.md` — абзац со ссылкой на `/temperament` сразу после вступления и в конце
- Modify: `packages/content/src/generated/articles.json` (`pnpm build:library`)

- [ ] **Step 1: Add** ссылки; `pnpm build:library`.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/lib/articles-integrity.test.ts packages/content` — Expected: PASS.
- [ ] **Step 3: Commit** `feat(content): temperament article links to the test`.

### Task 5: Финальная проверка

- [ ] **Step 1: Run** `pnpm test`, `pnpm typecheck`, e2e `short-test-attachment short-test-temperament test-flow public-navigation` на локальном dev-сервере (нужен `apps/web/.env.development.local` из примера) — Expected: всё зелёное.
- [ ] **Step 2:** финальное ревью ветки, PR из `feat/temperament-test` в `feat/short-tests` (или в `master`, если #179 уже слит), в описании — передача визуала Codex.
