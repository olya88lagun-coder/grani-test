# Режим пары для теста на тип привязанности — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Человек зовёт партнёра пройти тест на тип привязанности. Когда оба прошли тест и партнёр дал согласие, оба бесплатно видят общую карту. Разбор пары стоит 349 ₽ или 249 ₽ для тех, кто купил личный разбор, и открывается обоим.

**Architecture:** Отдельные таблицы `short_pair_invites` и `short_pairs` по образцу `pair_invites` и `pairs`, но со ссылками на `short_test_results`. Старые таблицы пар Big Five не меняются. У покупок появляется новая цель `short_pair`. Разбор пары собирается из готовых блоков только на сервере, через ту же точку входа `@grani/content/short-tests/report`. Вход партнёра идёт через ту же подписанную cookie `grani_short_pending`, в которую добавляются `intent` и `invite`.

**Tech Stack:** Next.js 16 App Router, Drizzle/Postgres (PGlite в тестах), pg-boss worker, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-short-tests-attachment-temperament-design.md` (разделы «Режим пары», «Монетизация», «Данные», «Доступ к покупкам…»).

**Ветка:** `feat/attachment-pair` от `feat/attachment-paid`. Если к моменту PR #185 уже смержен, PR идёт в `master`. Если нет, база PR — `feat/attachment-paid`.

## Global Constraints

- Цены: `attachment_pair: 34900`, `attachment_pair_discount: 24900`. Скидка положена, если у плательщика есть успешная покупка `attachment_solo`. Продукт выбирает сервер, клиенту цену не доверяем.
- Карта пары бесплатна обоим. Разбор пары открывается обоим, платит любой из двоих.
- Вход через VK только когда человек зовёт партнёра и когда партнёр хочет увидеть общую карту. Свой бесплатный результат партнёр видит без входа.
- Согласие партнёра на объединение результатов обязательно: галочка и версия `SHORT_PAIR_CONSENT_VERSION = "2026-11-08-v1"`, сохраняются в паре.
- Выход из пары работает как у пар Big Five: выйти может любой. После выхода страница пары и оплаченный разбор скрыты у обоих (404), покупка остаётся.
- Адреса не начинаются на `/test`. Приглашение — `/sp/<token>`, пара — `/short-pair/<id>`. Обе страницы закрыты в `robots` и помечены `noindex`.
- Тексты бережные, без диагнозов, по `docs/seo-article-writer.md`. Стоп-слова проверяет `findStopWords`.
- Тексты разбора пары не попадают в клиентский JS.
- Визуал делает Codex. Здесь только базовая вёрстка на существующих классах и CSS-модулях, без новой дизайн-работы.
- Юридические версии поднимаются до `2026-11-v5` (consent, privacy, offer). `LEGAL_DATE` ставится на день выпуска. Повторное согласие у старых пользователей не спрашиваем: решение владельца от 2026-11-08.

## Review Focus

1. Два участника одновременно принимают одну ссылку или жмут «Принять» дважды: создаётся ровно одна пара, второй запрос получает `already_used`.
2. Человек открывает свою же ссылку: пары с самим собой нет (`own`), и в БД стоит check.
3. Человек вышел из пары, а другой открывает `/short-pair/<id>` или платит: страница 404, `startPurchase` возвращает `not_found`. Уведомление по распавшейся паре не уходит.
4. Плательщик без личного разбора присылает `attachment_pair_discount`: сервер берёт 349 ₽. Купивший личный разбор платит 249 ₽, что бы ни прислал клиент. Повторно разбор пары не продаётся, если у пары уже есть любой из двух продуктов.
5. Чужой человек, не участник пары, открывает `/short-pair/<id>` или зовёт по чужому `shortResultId`: 404, ссылку не создаём.

---

### Task 1: Core — продукты, сочетания, воронка, уведомление

**Files:**
- Modify: `packages/core/src/pricing.ts`, `packages/core/src/reports.ts`, `packages/core/src/funnel.ts`, `packages/core/src/queues.ts`, `packages/core/src/short-tests.ts`
- Test: `packages/core/src/pricing.test.ts`, `packages/core/src/reports.test.ts`, `packages/core/src/funnel.test.ts`, `packages/core/src/short-tests.test.ts`, `packages/core/src/queues.test.ts`

**Interfaces:**
- Produces:
  - `PRODUCT_PRICES.attachment_pair = 34900` и `PRODUCT_PRICES.attachment_pair_discount = 24900`.
  - `ProductTarget` дополняется `"short_pair"`. `productTarget` для обоих новых продуктов возвращает `"short_pair"`, `reportKindsFor` для них возвращает `[]`.
  - `canBuy(p, owned)` для обоих новых продуктов: `!owned.includes("attachment_pair") && !owned.includes("attachment_pair_discount")`.
  - `pairProductFor(hasSolo: boolean): "attachment_pair" | "attachment_pair_discount"`.
  - `ATTACHMENT_PAIR_PRODUCTS = ["attachment_pair", "attachment_pair_discount"] as const`.
  - `combinationKey(order: readonly string[], a: string, b: string): string`. Возвращает `"<x>+<y>"`, где x идёт раньше y в `order`, поэтому порядок аргументов не важен.
  - `FUNNEL_STEPS` дополняется `"attachment_invite"` и `"attachment_pair"`. `funnelBase("attachment_pair") === "attachment_invite"`, `funnelBase("attachment_invite") === "attachment_finish"`.
  - `NotifyJob` дополняется `{ kind: "short_pair_created"; shortPairId: string }`, ключ `short_pair_created:<id>`.

- [ ] **Step 1: Write failing tests**
  - `pairProductFor(false) === "attachment_pair"`, `pairProductFor(true) === "attachment_pair_discount"`; цены 34900 и 24900.
  - `canBuy("attachment_pair", ["attachment_pair_discount"]) === false`, `canBuy("attachment_pair_discount", []) === true`.
  - `productTarget("attachment_pair") === "short_pair"`.
  - Для `order = ["secure","anxious","avoidant","fearful"]`: `combinationKey(order, "avoidant", "anxious") === "anxious+avoidant"`, `combinationKey(order, "secure", "secure") === "secure+secure"`. Из 4 типов получается ровно 10 разных ключей.
  - `funnelBase` для новых шагов и `notifyJobKey({kind:"short_pair_created",shortPairId:"x"}) === "short_pair_created:x"`.
- [ ] **Step 2:** `pnpm --filter @grani/core test`. Expected: новые тесты FAIL.
- [ ] **Step 3:** Реализовать. Комментарий в `pricing.ts`: скидочный продукт отдельный, чтобы у каждого продукта была одна цена.
- [ ] **Step 4:** `pnpm --filter @grani/core test`. Expected: PASS. `pnpm -r typecheck` покажет места, где нужно обработать новые продукты (`PRODUCT_DESCRIPTIONS`, `goalForProduct`, `productEnum`). Их закрывают задачи 3 и 4. Если typecheck красный только там, это ожидаемо, и это записывается в ledger.
- [ ] **Step 5: Commit** `feat(core): attachment pair products, combination key, pair funnel steps`

### Task 2: Content — сочетания (клиент) и разбор пары (сервер)

**Files:**
- Create: `packages/content/src/short-tests/attachment-pairs.ts` (клиентский), `packages/content/src/short-tests/attachment-pair-report.ts` (только сервер)
- Modify: `packages/content/src/short-tests/types.ts`, `attachment.ts`, `report.ts`, `index.ts`
- Test: `packages/content/src/short-tests/attachment-pairs.test.ts`, `packages/content/src/short-tests/report.test.ts`

**Interfaces:**
- Consumes: `combinationKey`, `ShortTestScore` из core.
- Produces:
  - В `ShortTestDefinition` появляется необязательный `pairOffer?: { title: string; lead: string; reportTitle: string; preview: readonly string[] }`. У `attachment` он заполнен, у `temperament` его нет.
  - `ShortPairCombination = { key: string; name: string; phrase: string; text: string }`. `name` — название сочетания, например «Погоня и побег». `phrase` — одна фраза о динамике для карты. `text` — 120–200 слов для SEO-страницы сочетаний.
  - `ATTACHMENT_COMBINATIONS: readonly ShortPairCombination[]` (10 штук), `getCombination(slug, typeA, typeB): ShortPairCombination | null`. Экспортируются из `@grani/content/short-tests`.
  - `ShortPairReportBlocks = { title; preview; byCombination: Record<key, { dynamics: Section; phrases: Section; exercises: Exercise[] }>; byType: Record<type, { inConflict: Section; needs: Section }>; axisGap: Record<axis, { close: Section; far: Section }> }`.
  - `buildShortPairReport(test, a: { name: string; score: ShortTestScore }, b: {...}): ShortPairReport | null` в `report.ts`. Порядок разделов: динамика; «{Имя A} в ссоре» и «{Имя B} в ссоре» (из `byType`, заголовок с именем); «Что нужно {Имя A}» и «Что нужно {Имя B}»; по каждой оси `close` (разница ≤ 25 пунктов) или `far`; фразы для разговора; 3–4 упражнения. Тест без `pairOffer` получает `null`.

- [ ] **Step 1: Write failing tests**
  - Ровно 10 сочетаний, ключи равны всем `combinationKey` для 4 типов. `getCombination("attachment","avoidant","anxious")` совпадает с `getCombination("attachment","anxious","avoidant")`. Для `temperament` возвращается `null`.
  - `text` каждого сочетания содержит 120–200 слов. У всех `name`, `phrase` и `text` нет стоп-слов.
  - Блоки разбора покрывают все 10 сочетаний, все 4 типа и обе оси. В каждом сочетании 3–4 упражнения.
  - Для каждого из 10 сочетаний собранный разбор (`buildShortPairReport` с именами «Аня» и «Борис») содержит не меньше 700 слов. Заголовки разделов с именами содержат «Аня» и «Борис».
  - В блоках разбора пары нет стоп-слов. `report.preview` совпадает с `getShortTest("attachment").pairOffer.preview`.
  - Утечка: `JSON.stringify(getShortTest("attachment"))` и `JSON.stringify(ATTACHMENT_COMBINATIONS)` не содержат двух уникальных фраз из `attachment-pair-report.ts`. Их выбирает исполнитель и записывает как константы в тесте.
- [ ] **Step 2:** `pnpm --filter @grani/content test`. Expected: FAIL.
- [ ] **Step 3:** Написать тексты: 10 сочетаний, блоки разбора, `pairOffer`. Подключить `ATTACHMENT_PAIR_REPORT` в `report.ts` как `SHORT_PAIR_REPORTS = { attachment: ATTACHMENT_PAIR_REPORT }`. `index.ts` его не экспортирует.
- [ ] **Step 4:** `pnpm --filter @grani/content test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): attachment pair combinations and pair report blocks`

### Task 3: DB — приглашения, пары, покупки

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/purchases.ts`, `packages/db/src/delete-user.ts`, `packages/db/src/index.ts`, `packages/db/src/testing.ts` (если реэкспорт там)
- Create: `packages/db/src/short-pairs.ts`, миграция `packages/db/drizzle/0020_short_pairs.sql` (`pnpm --filter @grani/db db:generate`, затем переименовать файл и тег в журнале)
- Test: `packages/db/src/short-pairs.test.ts`

**Interfaces:**
- Таблицы:
  - `short_pair_invites`: `id`, `token` unique, `test_slug`, `inviter_user_id` (cascade), `inviter_short_result_id` (FK `short_test_results`, cascade), `status` (переиспользовать `pairInviteStatusEnum`), `created_at`. Индекс по `inviter_short_result_id`.
  - `short_pairs`: `id`, `invite_id` unique (cascade), `test_slug`, `user_a_id`, `short_result_a_id`, `user_b_id`, `short_result_b_id` (все cascade), `partner_consent_at`, `partner_consent_version` text, `left_at`, `created_at`. Индексы `user_a`, `user_b`. Check `short_pairs_different_users`.
  - `purchases.short_pair_id` (FK `short_pairs`, set null), индекс. Check: `num_nonnulls(result_id, pair_id, space_id, short_result_id, short_pair_id) <= 1`. В `productEnum` добавить оба новых продукта.
- Produces (`short-pairs.ts`):
  - `getOrCreateShortPairInvite(db, { userId, shortResultId }): Promise<{ id; token }>`. Тест берётся из результата. Открытое приглашение на этот результат переиспользуется.
  - `getShortPairInviteByToken(db, token): Promise<{ id; token; status; testSlug; inviter: UserRecord; inviterShortResultId } | null>`.
  - `getLatestShortResult(db, { userId, testSlug }): Promise<ShortResultRecord | null>`.
  - `acceptShortPairInvite(db, { token, partnerUserId, partnerShortResultId, consentAt, consentVersion })` возвращает `{ ok: true; pairId } | { ok: false; reason: "not_found" | "own_invite" | "already_used" | "already_paired" | "wrong_test" }`. Условный UPDATE статуса в транзакции, как в `acceptPairInvite`. `wrong_test` — когда результат партнёра от другого теста. `already_paired` — когда у этих двоих уже есть активная пара по этому тесту.
  - `getShortPairForMember(db, pairId, userId): Promise<ShortPairRecord | null>`. Только активная пара (`left_at is null`) и только для участника. `ShortPairRecord = { id; testSlug; createdAt; members: readonly [{ user: UserRecord; result: ShortResultRecord }, {...}] }`.
  - `getActiveShortPair(db, pairId)`. То же без проверки участника, для worker.
  - `leaveShortPair(db, pairId, userId): Promise<boolean>`.
  - `listActiveShortPairs(db, { userId, testSlug }): Promise<{ id; partner: UserRecord; createdAt }[]>`.
  - В `purchases.ts`: `ShortPairTarget = { shortPairId: string }` входит в `OwnedTarget`. `targetWhere`, `ownedTargetId`, `TargetColumns`, `createPurchase` и `PurchaseRecord.shortPairId` поддерживают новую цель, а `listOwnedProducts({ shortPairId })` работает.
  - `deleteUserData` явно удаляет пары и приглашения пользователя до `short_test_results`. Покупки остаются с обнулённой ссылкой.

- [ ] **Step 1: Write failing tests** (`createTestDb`, `seedUser`, `saveShortResult`)
  - Ссылка создаётся и переиспользуется для того же результата. Чужой `shortResultId` (не владелец) — функция-обёртка в задаче 4 вернёт null. В DB-тесте проверяется только `getOrCreate` от владельца.
  - Партнёр принимает приглашение: `ok`, и `getShortPairForMember` у обоих возвращает обоих участников с их результатами. Чужому возвращается `null`.
  - Своя ссылка — `own_invite`. Повторное принятие — `already_used`. Два одновременных `acceptShortPairInvite` через `Promise.all` с разными партнёрами дают ровно один `ok`.
  - Результат партнёра от теста `temperament` — `wrong_test`. Вторая ссылка того же человека тому же партнёру после активной пары — `already_paired`.
  - После `leaveShortPair` `getShortPairForMember` возвращает `null` обоим, `listActiveShortPairs` пуст.
  - Покупка `attachment_pair` с целью `{ shortPairId }` сохраняется. `listOwnedProducts({ shortPairId })` после `markPurchaseSucceeded` возвращает `["attachment_pair"]`. Покупка с `shortResultId` и `shortPairId` сразу отклоняется check.
  - `deleteUserData(partner)`: пара и приглашение удалены, покупка осталась с `shortPairId === null`.
  - Тест PGlite-миграций и `pair-map-postgres.test.ts` по-прежнему зелёные: старые upgrade-тесты не должны зависеть от новой колонки.
- [ ] **Step 2:** `pnpm --filter @grani/db test -- short-pairs`. Expected: FAIL.
- [ ] **Step 3:** Схема, миграция, функции.
- [ ] **Step 4:** `pnpm --filter @grani/db test`. Expected: PASS. Если тесты виснут под нагрузкой, запускать файлы по одному.
- [ ] **Step 5: Commit** `feat(db): short test pairs, invites and pair purchase target`

### Task 4: Web server — сервис пар, оплата, вход

**Files:**
- Create: `apps/web/src/server/short-pairs-service.ts`
- Modify: `apps/web/src/server/payments-service.ts`, `apps/web/src/server/auth/tokens.ts`, `apps/web/src/server/login-service.ts`, `apps/web/src/server/login-context.ts`, `apps/web/src/lib/login-context.ts`, `apps/web/src/server/short-results-service.ts`, `apps/web/src/lib/analytics.ts`
- Test: `short-pairs-service.test.ts`, `payments-service.test.ts`, `login-service.test.ts`, `auth/tokens.test.ts`, `lib/login-context.test.ts`, `short-results-service.test.ts`

**Interfaces:**
- Produces (`short-pairs-service.ts`):
  - `SHORT_PAIR_CONSENT_VERSION = "2026-11-08-v1"`.
  - `createShortPairInviteForOwner(db, { userId, shortResultId }): Promise<string | null>`. Возвращает токен. `null` — если результат не свой или у теста нет `pairOffer`.
  - `ShortPairInvitePage = { state: "not_found" } | { state: "used"; inviterFirstName } | { state: "own"; token } | { state: "needs_result"; inviterFirstName; token; slug } | { state: "ready"; inviterFirstName; token; slug; typeName }`. Функция `getShortPairInvitePage(db, token, viewer)`. Гость и вошедший без результата этого теста получают `needs_result`.
  - `acceptShortPair(deps: { db; now; enqueueNotify }, { token, userId, consent })` → `{ ok: true; pairId } | { ok: false; error: "consent_required" | "no_result" | <reasons из задачи 3> }`. После `ok` ставится `short_pair_created`; сбой очереди только логируется, как в `acceptPair`.
  - `shortPairPage(db, { pairId, userId })` → `null` | `{ pairId; test; me: { firstName; score; typeName }; partner: { ... }; combination: ShortPairCombination; report: ShortPairReport | null; canBuy: boolean; product: "attachment_pair" | "attachment_pair_discount" }`. Баллы пересчитываются из ответов. `product = pairProductFor(hasPaidShortProduct(viewer, "attachment_solo"))`.
- В `payments-service.ts`:
  - `resolveTarget` для `short_pair` проверяет `getShortPairForMember`.
  - Для обоих парных продуктов `startPurchase` сначала заменяет `product` на `pairProductFor(hasSolo плательщика)`, потом проверяет `canBuy` по `listOwnedProducts({ shortPairId })`.
  - `PRODUCT_DESCRIPTIONS`: оба продукта — «Разбор пары по типу привязанности «Грани»».
  - `jobsFor` для пары коротких тестов — `[]`.
  - `getPurchaseView`: `reportUrl = /short-pair/<id>`, `ready = succeeded`.
- `ShortPending` дополняется `intent?: "report" | "pair"` и `invite?: string` (токен, проверяется `isInviteToken`). `signShortPending` и `verifyShortPending` переносят эти поля, неверный `invite` отбрасывается.
- Редирект в `completeLogin`: `pairReturnPath` → `togetherReturnPath` → (`shortPending.invite` → `/sp/<token>`) → (`intent === "pair"` → `/short/<id>#pair`) → `/short/<id>` → `/result/<id>` → `/test`. Сохранение ответов партнёра по-прежнему идёт через `saveShortAnswers`.
- `saveShortAnswers` принимает тест с `reportOffer` или `pairOffer`.
- `LoginContext` дополняется `"short_pair"`: «Откроем карту пары» / «Войдите, чтобы увидеть общую карту: ваш результат сохранится в кабинет». Выбирается, когда в cookie есть `invite` или `intent === "pair"`. Для `intent: "pair"` без приглашения: «Позовём партнёра» / «Войдите, чтобы получить ссылку для партнёра». Это отдельный контекст `"short_invite"`.
- `GOALS` дополняется `purchase_attachment_pair`. `goalForProduct` для обоих парных продуктов возвращает его.

- [ ] **Step 1: Write failing tests**
  - `acceptShortPair` без согласия — `consent_required`, без результата — `no_result`. С согласием создаётся пара с `partner_consent_version === SHORT_PAIR_CONSENT_VERSION` и одним вызовом `enqueueNotify({kind:"short_pair_created",...})`. Если `enqueueNotify` бросает ошибку, результат всё равно `ok`.
  - `getShortPairInvitePage` проходит все шесть состояний.
  - `shortPairPage`: чужому — `null`, после выхода — `null`. `canBuy` true до оплаты и false после, `report` наоборот. `product` — скидочный, если у зрителя есть `attachment_solo`.
  - `startPurchase`: если клиент прислал `attachment_pair_discount`, а у плательщика нет личного разбора, платёж создаётся на 34900. Купившему личный разбор с `attachment_pair` — на 24900. Когда второй участник уже оплатил, ответ `not_available`. Не участнику — `not_found`.
  - `completeLogin` с cookie `{slug, answers, invite}` сохраняет результат и ведёт на `/sp/<token>`. С `intent: "pair"` — на `/short/<id>#pair`.
  - Токен: `invite`, не прошедший `isInviteToken`, отбрасывается, остальная cookie действует.
- [ ] **Step 2:** `pnpm --filter @grani/web test -- <files>`. Expected: FAIL.
- [ ] **Step 3:** Реализовать.
- [ ] **Step 4:** `pnpm --filter @grani/web test` и `pnpm -r typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): attachment pair service, pair payment and partner login`

### Task 5: API и worker

**Files:**
- Create: `apps/web/src/app/api/short-pairs/invites/route.ts`, `apps/web/src/app/api/short-pairs/accept/route.ts`, `apps/web/src/app/api/short-pairs/[id]/leave/route.ts`
- Modify: `apps/web/src/app/api/short-results/route.ts`, `apps/worker/src/notify.ts`, `apps/worker/src/texts.ts`
- Test: `apps/worker/src/notify.test.ts`, `apps/worker/src/texts.test.ts`, `apps/web/src/app/api/short-results/route.test.ts` (новый; закрывает отложенную мелочь из #185 про origin и rate-limit)

**Interfaces:**
- `POST /api/short-pairs/invites { shortResultId }`: same-origin, `invitesLimiter`, вход обязателен. Ответ `{ ok, url: <APP_URL>/sp/<token> }` или 404.
- `POST /api/short-pairs/accept { token, consent }`: коды как в `/api/pairs/accept`, `wrong_test` → 409. Ответ `{ ok, redirect: "/short-pair/<id>" }`.
- `POST /api/short-pairs/[id]/leave`: 303 на `/privyazannost`, одинаково для чужой и уже покинутой пары.
- `POST /api/short-results`: тело дополняется `intent?: "report" | "pair"` и `invite?: string`. Вошедший с `invite` получает `/sp/<token>`, с `intent: "pair"` — `/short/<id>#pair`. Гость получает cookie с этими полями и `/login`.
- Worker: `short_pair_created` → пара через `getActiveShortPair`. Уведомление уходит только пригласившему (участник A): `shortPairCreatedText(firstName(B), combination.name, url)`, где url — `/short-pair/<id>`. Распавшаяся или ненайденная пара — задача завершается без отправки.

- [ ] **Step 1: Write failing tests**
  - Worker: отправка только A, в тексте имя B, название сочетания и ссылка. Если пары нет, `senders` не вызывается.
  - Route `/api/short-results`: чужой origin — 403. Превышенный лимит — 429. Тест без `reportOffer` и `pairOffer` — 400. Гость с `invite` получает cookie, в которой после `verifyShortPending` есть `invite`.
- [ ] **Step 2:** запустить тесты. Expected: FAIL.
- [ ] **Step 3:** Реализовать маршруты и обработку в worker.
- [ ] **Step 4:** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web,worker): attachment pair api and partner notification`

### Task 6: Страницы

**Files:**
- Create: `apps/web/src/app/sp/[token]/page.tsx`, `apps/web/src/app/sp/[token]/AcceptShortPairForm.tsx`, `apps/web/src/app/short-pair/[id]/page.tsx`, `apps/web/src/app/privyazannost/sochetaniya/page.tsx`, `apps/web/src/components/short-tests/ShortPairInvite.tsx`
- Modify: `AxisMap.tsx` (необязательные `points: { x; y; label }[]` вместо одной точки; старые пропсы работают), `ShortTestResult.tsx` (кнопка «Пройти вдвоём с партнёром» при `test.pairOffer` и `onInvitePartner`; при `partnerInvite` подпись кнопки — «Увидеть общую карту»), `ShortTestRunner.tsx` (необязательный `invite?: string`; `openReport(intent)` шлёт `intent`/`invite`), `apps/web/src/app/short/[id]/page.tsx` (секция `id="pair"`: `InviteLink` на `/api/short-pairs/invites` и ссылки на активные пары), `apps/web/src/app/robots.ts` (`/sp/`, `/short-pair/`), `apps/web/src/lib/seo.ts` (`/privyazannost/sochetaniya` в `PUBLIC_PATHS`), `apps/web/src/app/admin/funnel/page.tsx` (подписи шагов), `ShortTestPage.tsx` (ссылка на страницу сочетаний)
- Test: `robots.test.ts`, `seo.test.ts`, e2e в задаче 8

**Interfaces:**
- `/sp/[token]`: `noindex`, `force-dynamic`. H1 «{Имя} зовёт вас пройти тест на тип привязанности вдвоём». `needs_result` — `ShortTestRunner slug invite={token}`. `ready` — «Ваш тип: …», `AcceptShortPairForm` с галочкой «Я согласен(на) показать {Имя} свой тип и баллы и увидеть {его/её} результат на общей карте». `used`, `own`, `not_found` — тексты по образцу `/p/[token]`.
- `/short-pair/[id]`: `requireUser`, `noindex`, 404 через `shortPairPage === null`. H1 «Карта пары: {сочетание.name}». `AxisMap` с двумя точками, подписанными именами. Названия обоих типов, `combination.phrase`, ссылка «Все сочетания» на `/privyazannost/sochetaniya`. Дальше либо разбор (разделы `report`), либо предложение: превью `pairOffer.preview` и `BuyButton product targetId=pairId` с подписью «Открыть обоим за 349 ₽» или «Открыть обоим за 249 ₽ — скидка за личный разбор». Внизу форма POST на leave: «Выйти из пары».
- Воронка: `attachment_invite` — когда ссылка создана в `ShortPairInvite`; `attachment_pair` — на сервере после успешного `acceptShortPair` (как остальные серверные шаги; если они клиентские, следовать существующему способу).
- `/privyazannost/sochetaniya`: серверная страница, индексируется. H1 «Сочетания типов привязанности в паре». Блок «Кратко» и 10 разделов H2 (`name`, `phrase`, `text`) с якорями `#<key>`. FAQ из 3–4 вопросов с разметкой FAQPage, как на `/privyazannost`. Title до 57 знаков, тест на длину — как у страниц типов.

- [ ] **Step 1:** Тесты `robots` и `seo`: новые закрытые пути и `sochetaniya` в sitemap. Expected: FAIL.
- [ ] **Step 2:** Страницы и компоненты.
- [ ] **Step 3:** `pnpm --filter @grani/web test`, typecheck, ручная проверка на `pnpm dev:web`.
- [ ] **Step 4: Commit** `feat(web): attachment pair invite, pair map page and combinations page`

### Task 7: Документы и цены

**Files:** `apps/web/src/lib/legal.ts`, `apps/web/src/app/{consent,privacy,offer,pricing}/page.tsx`, `docs/data-retention.md`, `docs/seo-content-pipeline.md`, тесты страниц, если они проверяют версии и текст.

- Политика и согласие: результат короткого теста сохраняется и тогда, когда человек зовёт партнёра или принимает приглашение. Партнёры видят тип и баллы друг друга только после согласия приглашённого. После выхода из пары общая карта скрывается. Срок хранения и удаление — как у результатов коротких тестов.
- Оферта и `/pricing`: «Разбор пары по типу привязанности» — 349 ₽, 249 ₽ для купивших личный разбор, открывается обоим участникам, сразу после оплаты, и скрывается, если один из партнёров вышел из пары.
- `LEGAL_VERSIONS` → `2026-11-v5`.

- [ ] Тест: e2e или юнит проверяет, что на `/pricing` и `/offer` есть 349 и 249. Сначала FAIL, потом PASS.
- [ ] **Commit** `docs(legal): attachment pair report in consent, privacy, offer and pricing`

### Task 8: E2E

**Files:** `e2e/short-test-attachment-pair.spec.ts`

- [ ] Сценарий 1: гость проходит тест → «Пройти вдвоём» → `/login` → dev-вход «Аня» → `/short/<id>#pair` → ссылка `/sp/<token>`. Новый контекст «Борис» открывает ссылку и видит H1 с «Аня». Проходит тест и видит свой результат без входа. «Увидеть общую карту» → `/login` → dev-вход → `/sp/<token>`, галочка, «Принять» → `/short-pair/<id>` с «Карта пары». У Ани та же страница открывается. Борис платит на fake-pay 349 ₽, у Ани открыт разбор. Аня выходит из пары, у Бориса страница даёт 404.
- [ ] Сценарий 2: купивший личный разбор видит в паре «249».
- [ ] Сценарий 3: своя ссылка — «Это ваша ссылка». Чужой `/short-pair/<id>` — 404. `/privyazannost/sochetaniya` — 10 разделов H2.
- [ ] Сценарий 4: JS страниц `/sp/<token>` и `/privyazannost` не содержит фраз-констант разбора пары из задачи 2.
- [ ] Запуск: `pnpm dev:db`, `pnpm dev:web`, `pnpm dev:worker`, затем `npx playwright test -c e2e/playwright.config.ts short-test-attachment` и весь набор коротких тестов. Expected: PASS. Старые падения в `launch.spec.ts` и `purchase.spec` известны и в этот план не входят.
- [ ] **Commit** `test(e2e): attachment pair mode`

## Задачи для Codex после PR

- Карта с двумя точками, страница пары и предложение разбора.
- Страница приглашения `/sp/<token>`.
- Блок приглашения на `/short/<id>`.
- Страница сочетаний.
