# Платный личный разбор привязанности (199 ₽) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** После бесплатного результата теста привязанности человек может открыть личный разбор за 199 ₽: входит через VK, его результат сохраняется в аккаунт, оплата через существующую ЮKassa, разбор собирается из готовых блоков и открывается сразу.

**Architecture:** Новая таблица `short_test_results` (только для вошедших). Ответы до входа едут через вход в подписанной cookie — так же, как отложенный результат Big Five (`grani_pending`). Покупка получает новую цель «результат короткого теста» рядом с `resultId`/`pairId`/`spaceId`. Разбор не генерируется: он собирается из блоков `@grani/content` при показе, поэтому готов сразу после оплаты.

**Tech Stack:** Next.js 16 App Router, Drizzle + Postgres (миграции `drizzle-kit generate`), vitest (`createTestDb` для БД), Playwright (dev-вход `DEV_LOGIN=1`, оплата `PAYMENTS_FAKE=1`).

**Spec:** `docs/superpowers/specs/2026-11-07-short-tests-attachment-temperament-design.md` — разделы «Монетизация», «Данные», «Доступ к покупкам…», этап 3 (личная часть). Режим пары и разбор пары — следующий план.

**Порядок относительно спеки:** спека ставит режим пары (этап 2) до платных разборов (этап 3). Здесь сначала личный разбор: большинство приходит одно, он раньше даёт деньги, а таблицы, вход и цель покупки из этого плана нужны и паре.

## Global Constraints

- Бесплатный результат по-прежнему без входа и без сервера (этап 1 не меняется). На сервер ответы уходят только когда человек нажал «Открыть разбор» — и тогда он входит через VK.
- До входа ответы на сервере не хранятся: только в подписанной httpOnly cookie на время входа (как `grani_pending`, тот же срок жизни).
- Цена `attachment_solo` — 19900 копеек. Описание для чека: «Личный разбор типа привязанности «Грани»».
- Доступ к личному разбору — у пользователя по тесту: любая успешная покупка `attachment_solo` открывает разбор для **любого** его результата теста `attachment`, включая пройденный заново (спека, «Повторное прохождение»). В покупке хранится результат, за который платили.
- Покупка за 0 ₽ владельцу (`isOwner`) — как у остальных продуктов.
- Страница сохранённого результата `/short/[id]` — только владельцу, не индексируется: `Disallow: /short/` в `robots.ts`, `robots: { index: false }` в metadata.
- Тексты разбора: бережно, без диагнозов, `findStopWords` пуст. Пишет исполнитель.
- Визуал — Codex: интерфейс рабочий минимум, в PR — передача Codex.
- Юридическое: тексты `/consent`, `/privacy`, `/offer` дополняются новыми данными и продуктом, `LEGAL_VERSIONS` поднимаются. Как уже вошедшие пользователи подтверждают новую версию — повторить существующий механизм (исполнитель читает `upsertUserFromIdentity` и `verifyConsent`; если повторного согласия для старых пользователей нет — не добавлять его, а зафиксировать ruling).

## Review Focus

1. Человек купил разбор, прошёл тест заново — новый результат открывается с разбором без второй оплаты. Тест: Task 3 (`hasShortReport`) и Task 6 (e2e).
2. Чужой `/short/<id>` — 404, а не чужой результат. Тест: Task 5.
3. Повтор вебхука или двойной клик «Оплатить» не создаёт двух оплаченных покупок и не ломает выдачу. Тест: Task 4 (`startPurchase` reuse window, `syncPayment` повтор).
4. Cookie с ответами подделана, просрочена или от другого теста — вход проходит как обычно, результат не сохраняется, человек попадает на `/test`-подобную страницу по умолчанию, а не на ошибку. Тест: Task 5 (`completeLogin`).
5. Удаление аккаунта удаляет результаты коротких тестов, но покупка остаётся с обнулённой ссылкой (налоговый учёт). Тест: Task 2.

---

### Task 1: Тексты личного разбора

**Files:**
- Modify: `packages/content/src/short-tests/types.ts` — поле `report?`
- Modify: `packages/content/src/short-tests/attachment.ts` — блоки разбора
- Create: `packages/content/src/short-tests/report.ts` — сборка разбора
- Modify: `packages/content/src/short-tests/index.ts` — экспорт
- Test: `packages/content/src/short-tests/report.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type ShortReportBlocks = {
    title: string;                       // «Личный разбор типа привязанности»
    preview: readonly string[];          // заголовки разделов для размытого превью
    byType: Readonly<Record<string, readonly ShortTestSection[]>>; // по ключу типа: «Откуда это», «Что вы делаете в ссоре», «Когда партнёр отдаляется», «Какой партнёр даётся тяжелее всего»
    byAxisLevel: Readonly<Record<string, Readonly<Record<"low" | "mid" | "high", ShortTestSection>>>>; // по оси: что значит именно ваш уровень
    exercises: Readonly<Record<string, readonly { title: string; text: string }[]>>; // по типу, 3–4 упражнения
  };
  // ShortTestDefinition получает: report?: ShortReportBlocks;  // нет поля — нет платного разбора

  // report.ts
  export type ShortReport = { title: string; sections: readonly ShortTestSection[]; exercises: readonly { title: string; text: string }[] };
  export function axisLevel(value: number): "low" | "mid" | "high"; // < 40 low, 40–60 mid, > 60 high
  export function buildShortReport(test: ShortTestDefinition, score: ShortTestScore): ShortReport | null; // null, если у теста нет report
  ```
- [ ] **Step 1: Write the failing tests:** для `attachment`: `report` есть, `byType` покрывает 4 типа по 4 раздела, `byAxisLevel` — обе оси × 3 уровня, `exercises` — 3–4 на тип; весь текст разбора ≥ 900 слов для каждого типа; `findStopWords` пуст; `buildShortReport` для синтетического «тревожного» результата содержит разделы `byType.anxious`, раздел уровня `high` тревожности и `low` избегания; `axisLevel(39) === "low"`, `axisLevel(40) === "mid"`, `axisLevel(60) === "mid"`, `axisLevel(61) === "high"`; у `temperament` `buildShortReport` → `null`.
- [ ] **Step 2: Run** `pnpm vitest run packages/content/src/short-tests` — Expected: FAIL.
- [ ] **Step 3: Implement** типы, сборку и тексты.
- [ ] **Step 4: Run** те же тесты и `pnpm --filter @grani/content typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): attachment solo report blocks`.

### Task 2: Таблица результатов коротких тестов и цель покупки

**Files:**
- Modify: `packages/db/src/schema.ts` — таблица `short_test_results`; колонка `purchases.short_result_id`; check `purchases_at_most_one_target` с новой колонкой; значение `attachment_solo` в `productEnum`
- Create: миграция `packages/db/drizzle/0019_short_test_results.sql` через `pnpm --filter @grani/db db:generate`
- Create: `packages/db/src/short-results.ts`, `packages/db/src/short-results.test.ts`; экспорт из `packages/db/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  // schema: short_test_results(id uuid pk, user_id uuid not null fk users cascade, test_slug text not null,
  //   answers jsonb not null, scores jsonb not null, type_key text not null, created_at) + index (user_id, test_slug, created_at)
  export type ShortResultRecord = { id: string; userId: string; testSlug: string; answers: Record<string, number>; scores: Record<string, number>; typeKey: string; createdAt: Date };
  export function saveShortResult(db: Database, p: { userId: string; testSlug: string; answers: Record<string, number>; scores: Record<string, number>; typeKey: string }): Promise<ShortResultRecord>;
  export function getShortResultForOwner(db: Database, id: string, userId: string): Promise<ShortResultRecord | null>;
  export function hasPaidShortProduct(db: Database, p: { userId: string; product: "attachment_solo" }): Promise<boolean>; // любая succeeded покупка этого продукта у пользователя
  ```
  Тип цели покупки (`ReportTarget` или его аналог в `packages/db`) получает вариант `{ shortResultId: string }`; `createPurchase` / `findOpenPurchase` / `listOwnedProducts` принимают его.
- [ ] **Step 1: Write the failing tests** (`createTestDb`): сохранение и чтение владельцем; чужой `userId` → `null`; `hasPaidShortProduct` — `false` без покупки, `false` для `pending`, `true` после `markPurchaseSucceeded`; покупка с `shortResultId` создаётся, а с `shortResultId` и `resultId` одновременно — ошибка БД (check); удаление пользователя каскадом удаляет `short_test_results`, а покупку оставляет с `short_result_id = null`.
- [ ] **Step 2: Run** `pnpm vitest run packages/db/src/short-results.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** схему, `pnpm --filter @grani/db db:generate`, функции.
- [ ] **Step 4: Run** `pnpm vitest run packages/db` и `pnpm typecheck` — Expected: PASS (существующие тесты миграций тоже).
- [ ] **Step 5: Commit** `feat(db): short test results and purchase target`.

### Task 3: Продукт `attachment_solo` в core

**Files:**
- Modify: `packages/core/src/pricing.ts` (+ тест) — `attachment_solo: 19900`
- Modify: `packages/core/src/reports.ts` (+ тест) — `ProductTarget` += `"short_result"`; `productTarget("attachment_solo") === "short_result"`; `reportKindsFor("attachment_solo")` → `[]` (не генерируется); `canBuy("attachment_solo", owned)` → `!owned.includes("attachment_solo")`
- Modify: `apps/web/src/lib/analytics.ts` (+ тест) — `goalForProduct("attachment_solo")` → новая цель `"purchase_attachment"` в `GOALS`
- Modify: `apps/web/src/server/payments-service.ts` — `PRODUCT_DESCRIPTIONS.attachment_solo`

**Interfaces:**
- Produces: `PRODUCT_PRICES.attachment_solo === 19900`; `productTarget`, `reportKindsFor`, `canBuy` как выше; `Goal` += `"purchase_attachment"`.
- [ ] **Step 1: Write the failing tests** для каждого пункта выше; `canBuy("full", ["attachment_solo"]) === true` (продукты не влияют друг на друга).
- [ ] **Step 2: Run** `pnpm vitest run packages/core apps/web/src/lib/analytics.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Все `switch`/`Record<Product, …>` в коде, которые станут неполными, — дополнить (найдёт `pnpm typecheck`).
- [ ] **Step 4: Run** `pnpm vitest run packages/core apps/web/src/lib` и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): attachment_solo product`.

### Task 4: Оплата личного разбора

**Files:**
- Modify: `apps/web/src/server/payments-service.ts` (+ тест)
- Create: `apps/web/src/server/short-results-service.ts` (+ тест)

**Interfaces:**
- Consumes: Task 2, Task 3.
- Produces:
  ```ts
  // short-results-service.ts
  export type ShortResultsDeps = { db: Database };
  export function saveShortAnswers(deps: ShortResultsDeps, p: { userId: string; slug: string; answers: unknown }): Promise<{ ok: true; id: string } | { ok: false }>; // пересчёт scoreShortTest на сервере, баллам клиента не доверяем
  export function shortResultPage(deps: ShortResultsDeps, p: { id: string; userId: string }): Promise<null | { test: ShortTestDefinition; score: ShortTestScore; resultId: string; report: ShortReport | null; canBuy: boolean }>; // report не null, только если hasPaidShortProduct; canBuy — у теста есть report и покупки ещё нет
  ```
  В `payments-service`: `resolveTarget` для `short_result` проверяет `getShortResultForOwner`; `purchaseTarget` и `getPurchaseView` знают `shortResultId`; для `attachment_solo` нет задач генерации, `ready = status === "succeeded"`, `reportUrl = /short/<shortResultId>`.
- [ ] **Step 1: Write the failing tests:** `saveShortAnswers` — неизвестный slug / неполные ответы / значение 7 → `{ ok: false }`; валидные → строка в БД с баллами, равными `scoreShortTest`. `shortResultPage` — чужой id → `null`; без покупки `report === null`, `canBuy === true`; после успешной покупки на **другом** результате того же теста `report !== null`. `startPurchase({ product: "attachment_solo", targetId: <чужой short id> })` → `not_found`; для своего — создаёт покупку на 19900 с `shortResultId`; второй вызов в окне повторного использования возвращает тот же `confirmationUrl`; после оплаты `canBuy` → `not_available`. `syncPayment` дважды по одному платежу → одна успешная покупка. `getPurchaseView` после оплаты → `ready: true`, `reportUrl: "/short/<id>"`. Владелец → покупка за 0 и сразу `succeeded`.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/server/short-results-service.test.ts apps/web/src/server/payments-service.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run apps/web/src/server` и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): pay for the attachment solo report`.

### Task 5: Перенос ответов через вход и страница `/short/[id]`

**Files:**
- Modify: `apps/web/src/server/http.ts` — `SHORT_PENDING_COOKIE = "grani_short_pending"` и её опции (как `pendingCookieOptions`)
- Modify: `apps/web/src/server/auth/tokens.ts` (+ тест) — подпись/проверка `{ slug, answers }` (переиспользовать механизм `signPending`/`verifyPending`)
- Create: `apps/web/src/app/api/short-results/route.ts` (+ тест по образцу `results` route)
- Modify: `apps/web/src/server/login-service.ts` (+ тест) — `completeLogin` сохраняет короткий результат из cookie; `redirectTo`: пара → «Вдвоём» → `/short/<id>` → Big Five как сейчас
- Modify: `apps/web/src/app/api/auth/vk/callback/route.ts`, `apps/web/src/app/api/dev/login/route.ts` — передать и затем стереть cookie
- Modify: `apps/web/src/lib/login-context.ts`, `apps/web/src/server/login-context.ts` (+ тесты) — контекст `"short"` с текстом «Войдите, чтобы открыть разбор — результат сохранится в ваш кабинет»
- Create: `apps/web/src/app/short/[id]/page.tsx` — результат (`ShortTestResult` без «Пройти заново»), под ним либо разбор, либо размытое превью + кнопка «Открыть за 199 ₽» (существующий `BuyButton` с `product="attachment_solo"`)
- Modify: `apps/web/src/app/robots.ts` (+ тест) — `Disallow: /short/`
- Modify: `apps/web/src/components/short-tests/ShortTestResult.tsx`, `ShortTestRunner.tsx` — кнопка «Открыть личный разбор — 199 ₽», если у теста есть `report`: POST `/api/short-results { slug, answers }` → переход по `redirect`
- Create: `e2e/short-test-attachment-paid.spec.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces: `POST /api/short-results` → `{ ok: true, redirect: "/short/<id>" }` для вошедшего; `{ ok: true, redirect: "/login" }` + cookie для гостя; `{ ok: false, error: "invalid_answers" }` 400; rate limit и проверка origin — как у `/api/results`.

- [ ] **Step 1: Write the failing tests:** route — гость получает cookie и `/login`; вошедший — `/short/<id>`; неверные ответы → 400; чужой origin → 403. `completeLogin` с валидной cookie → результат сохранён, `redirectTo === "/short/<id>"`; с подделанной/просроченной/чужого теста — ничего не сохранено, `redirectTo` как раньше. `robots` содержит `/short/`. e2e (dev-вход, `PAYMENTS_FAKE`): пройти тест → «Открыть личный разбор» → вход → `/short/<id>` с превью → «Открыть за 199 ₽» → оплата → разбор виден; пройти тест заново → снова «Открыть разбор» → новый `/short/<id>` сразу с разбором; чужой `/short/<id>` → 404.
- [ ] **Step 2: Run** `pnpm vitest run apps/web/src/server apps/web/src/app/api/short-results apps/web/src/lib` и `npx playwright test -c e2e/playwright.config.ts short-test-attachment-paid` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** те же команды, `short-test-attachment`, `test-flow`, `pairs`, `purchase` e2e и `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): open the attachment solo report after login and payment`.

### Task 6: Юридические тексты и цены

**Files:**
- Modify: `apps/web/src/lib/legal.ts` — `LEGAL_VERSIONS` (consent, privacy, offer) на `2026-11-v4`
- Modify: тексты `/consent`, `/privacy`, `/offer` (найти их источник через `rg "LEGAL_VERSIONS|Публичная оферта" apps/web/src`) — результаты коротких тестов как категория данных, цель и срок хранения; продукт «Личный разбор типа привязанности» 199 ₽
- Modify: `apps/web/src/app/pricing/page.tsx` — строка продукта
- Modify: `docs/data-retention.md` — `short_test_results`, cookie `grani_short_pending`
- Test: существующие тесты legal/pricing + e2e `launch` (документы в подвале)

- [ ] **Step 1: Write the failing test:** `/pricing` содержит «Личный разбор типа привязанности» и «199»; `/offer` содержит тот же продукт и цену (по образцу существующих проверок цен).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** тексты; прочитать, как `CONSENT_VERSION` используется при входе, и повторить существующее поведение для старых пользователей (ruling, если повторного согласия нет).
- [ ] **Step 4: Run** `pnpm vitest run apps/web` и e2e `launch purchase` — Expected: PASS (кроме двух уже падающих на master тестов `launch.spec.ts`).
- [ ] **Step 5: Commit** `docs(legal): attachment solo report in consent, privacy, offer and pricing`.

### Task 7: Финальная проверка

- [ ] **Step 1: Run** `pnpm test`, `pnpm typecheck`, e2e `short-test-attachment short-test-attachment-paid short-test-temperament test-flow pairs purchase` на локальном dev (нужны `.env.development.local` из примера, `pnpm dev:db`).
- [ ] **Step 2:** ревью всей ветки; PR в `master` с передачей визуала (`/short/[id]`, кнопка покупки, размытое превью) Codex и списком юридических правок для владельца.
