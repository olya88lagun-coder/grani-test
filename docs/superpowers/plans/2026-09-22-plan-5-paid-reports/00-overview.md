# План 5 — Платные разборы: оплата ЮKassa, полный разбор, главы, «как меня видят другие», разбор пары

> **Статус: выполнен 2026-09-22.** 468 тестов + 9 сквозных (Playwright, с работающим воркером, два прогона подряд); покрытие: строки 93,9%, выражения 92,2%, функции 90,1%, ветви 88,8%. Сборки сайта и воркера без предупреждений. Оплата проверена через поддельный шлюз, разборы — сборкой из блоков (`AI_PROVIDER=none`); настоящие ЮKassa и ИИ — при выкладке (план 6).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Вошедший пользователь покупает полный разбор (299 ₽), главы по сферам (99 ₽ / 249 ₽ за четыре) и разбор пары (399 ₽, открывается обоим). Оплата — ЮKassa; после подтверждения воркер генерирует разбор через YandexGPT или GigaChat, а если модель не справилась — собирает его из блоков без ИИ. Раздел «Как меня видят другие» генерируется один раз, когда куплен полный разбор и ответили трое друзей. О готовом разборе приходит уведомление. Карточка «инструкция по применению меня» и рабочая редакция оферты.

**Architecture:** `packages/core` получает правила продуктов и разборов (`reports.ts`: виды разборов, что открывает каждая покупка, что можно купить) и задачу очереди `generate`. Новый пакет `packages/ai` без ввода-вывода кроме `fetch` провайдеров: схемы разделов (zod), сборка входа из блоков `packages/content` (без имён и идентификаторов), запасная сборка из блоков, инструкция модели, проверка ответа (схема + стоп-слова), попытки с таймаутом, провайдеры YandexGPT и GigaChat. `packages/db` — таблицы `purchases` и `reports`. `apps/web` — шлюз ЮKassa (и поддельный шлюз для локальной разработки и сквозных тестов), сервис покупок (цена только с сервера, уведомление ЮKassa проверяется по IP и повторным запросом статуса, переход в `succeeded` одним условным `UPDATE` ставит задачи генерации), страницы разбора и ожидания. `apps/worker` разбирает очередь `generate`: читает базу, собирает вход, генерирует, сохраняет (уникальность `(result_id, kind)` / `(pair_id, kind)` защищает от второй генерации) и ставит уведомление `report_ready`.

**Tech Stack:** как в плане 4. Новых npm-зависимостей нет: ЮKassa, YandexGPT и GigaChat вызываются через `fetch`.

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` — разделы 2.1 шаги 4–6, 4.2, 4.3, 4.4, 4.5 (карточка «инструкция»), 4.6 п. 5–6, 5.2 (`purchases`, `reports`), 5.3 «Оплата», 6 (оферта, дисклеймер, возвраты), 7 (`packages/ai`, «Оплата», «Пары»).
**Дизайн:** `docs/design/visual-direction.md` — личный разбор в палитре «Оранжерея», разбор пары — в «Глине» (`data-palette="pair"`), раздел друзей — в «Тумане» (`data-palette="friends"`).
**Предыдущий план:** `docs/superpowers/plans/2026-09-17-plan-4-friends-pairs/` (выполнен, PR #4)

## Global Constraints

- Ветка плана `feat/paid-reports` от `master` после мержа PR #4. PR в `master` — после зелёного CI и согласия пользователя.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`. После `pnpm add` — `pnpm dedupe` (иначе две копии `drizzle-orm`, см. план 4).
- Имена пакетов: новый `@grani/ai`. Очередь pg-boss `generate`; имена очередей и типы задач — в `packages/core/src/queues.ts`.
- **Цены** — только `PRODUCT_PRICES` из `@grani/core` (копейки): полный разбор 29900, глава 9900, четыре главы 24900, разбор пары 39900. Сумма платежа берётся на сервере, от клиента приходят только продукт и id результата или пары.
- **Что можно купить** (`canBuy` в `packages/core/src/reports.ts`): полный разбор — один раз на результат; главы — только после оплаченного полного разбора этого результата; «все четыре» — только если ни одна глава ещё не куплена; отдельная глава — если она не открыта ни отдельной покупкой, ни «всеми четырьмя»; разбор пары — один раз на пару, платит любой из двоих активной пары. Продукты `full` и `chapter_*`/`chapters_all` привязаны к `result_id`, `pair` — к `pair_id`.
- **Оплата** (спецификация 5.3): платёж создаётся с `Idempotence-Key` = id покупки, `capture: true`, `confirmation.type = "redirect"`, `return_url = APP_URL/purchases/<id>`, `metadata.purchase_id`. Уведомление `POST /api/yookassa/notification` принимается только с IP ЮKassa (`185.71.76.0/27`, `185.71.77.0/27`, `77.75.153.0/25`, `77.75.156.11`, `77.75.156.35`, `77.75.154.128/25`, `2a02:5180::/32`), после чего статус платежа **всегда** запрашивается через API; состояние покупки меняется только по ответу API и только если совпали `metadata.purchase_id` и сумма. Переход `pending → succeeded` — один условный `UPDATE`; задачи генерации ставятся только тем запросом, который этот переход сделал. Страница ожидания тоже синхронизирует статус через API — оплата открывается, даже если уведомление задержалось.
- Секреты ЮKassa (`YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`) и ИИ (`YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `GIGACHAT_AUTH_KEY`) — только в `.env` на сервере или в `.env.development.local`; агенту не присылаются.
- Локально и в сквозных тестах оплата идёт через **поддельный шлюз** (`PAYMENTS_FAKE=1`, только вне production): страница `/dev/pay/<id>` с кнопками «Оплатить» и «Отменить» вместо ЮKassa. ИИ локально выключен (`AI_PROVIDER=none`) — разборы собираются из блоков.
- **Генерация** (спецификация 4.4): вход модели — баллы, уровни черт, код и название типа, уточнение, выбранные блоки, разница с друзьями, варианты пары; **имена, пол и идентификаторы не передаются**. Инструкция: связать блоки в текст на «ты» (разбор пары — на «вы»), не добавлять фактов, которых нет в блоках. Ответ — JSON по разделам; проверка — zod-схема с пределами длины и `findStopWords` по всем строкам. Ошибка, таймаут 60 с или непрошедшая проверка — до 2 повторных попыток, затем сборка из блоков, `source = "fallback"`. Готовый разбор повторно не генерируется.
- Раздел «Как меня видят другие» (`kind = "friends"`) генерируется один раз: задача ставится при оплате полного разбора, если друзей уже ≥ 3, и при ответе друга, если полный разбор оплачен; воркер повторно проверяет оба условия.
- Разбор пары виден только участникам активной пары; после выхода — 404 обоим (как страница пары в плане 4). Деньги за разбор пары при выходе не возвращаются — это написано в оферте.
- **Дисклеймер** на странице разбора, разборе пары и в оферте: «Материалы для самопознания, не психологическая и не медицинская диагностика».
- Возврат, если разбор не удалось выдать, — вручную через личный кабинет ЮKassa (сбой запасной сборки из блоков — ошибка кода, а не штатный путь); оферта обещает полный возврат.
- Все POST, меняющие состояние, проверяют `Origin` == `APP_URL` (кроме уведомления ЮKassa — его подлинность подтверждают IP и повторный запрос); создание покупок ограничено по частоте.
- Визуальный стиль — `docs/design/visual-direction.md`; цвета только из CSS-переменных; палитры через `data-palette`.
- Тесты: Vitest (AAA), репозитории и сервисы — с PGlite, провайдеры ИИ и ЮKassa — с заглушкой `fetch`; сквозные — Playwright на локальном приложении с dev-входом и поддельным шлюзом. Покрытие `packages/*/src`, `apps/web/src/server`, `apps/web/src/lib`, `apps/worker/src` ≥ 80%.
- **Каждое действие вне репозитория (магазин ЮKassa, ключи ИИ, GitHub Settings) делает пользователь**; агент ждёт подтверждения и значений без секретов.
- Коммиты — conventional commits, без Co-Authored-By. Ответы пользователю — по-русски.

## Предварительные действия пользователя

Для кода плана не нужны: всё проверяется с поддельным шлюзом и сборкой из блоков. Нужны для настоящей проверки при выкладке (план 6).

1. **ЮKassa:** зарегистрировать магазин как самозанятая, подключить выдачу чеков через «Мой налог», создать тестовый магазин. `shopId` и секретный ключ — только в `.env` на сервере.
2. **ИИ — один из двух:**
   - YandexGPT: Yandex Cloud → каталог → сервисный аккаунт с ролью `ai.languageModels.user` → API-ключ. Нужны ID каталога и ключ.
   - GigaChat: developers.sber.ru → проект GigaChat API → «Ключ авторизации» (для самозанятой — уточнить тариф и `scope`: `GIGACHAT_API_PERS` или `GIGACHAT_API_B2B`). Серверу понадобится корневой сертификат Минцифры (`NODE_EXTRA_CA_CERTS`) — план 6.

## Задачи

| # | Файл | Что делает | Тип |
|---|---|---|---|
| 1 | `task-01-rules.md` | `core/reports.ts` (виды разборов, `canBuy`), задача `generate` и уведомление `report_ready`; подписи черт и сравнение с друзьями переезжают в `@grani/content` | код |
| 2 | `task-02-db.md` | миграция `purchases`, `reports`; репозитории покупок и разборов, `getResult` | код |
| 3 | `task-03-ai-sections.md` | `packages/ai`: схемы разделов, сборка входа из блоков, сборка разбора без ИИ | код |
| 4 | `task-04-ai-generate.md` | инструкция модели, проверка ответа, попытки и таймаут, провайдеры YandexGPT и GigaChat | код |
| 5 | `task-05-payments-service.md` | шлюз ЮKassa и поддельный шлюз, проверка IP, сервис покупок, постановка задач `generate` | код |
| 6 | `task-06-payments-routes.md` | маршруты покупки, статуса, уведомления ЮKassa, страница поддельной оплаты | код |
| 7 | `task-07-worker-generate.md` | воркер: очередь `generate`, сохранение разбора, уведомление «разбор готов» | код |
| 8 | `task-08-report-pages.md` | превью и кнопка покупки на результате, страница ожидания, страница разбора с главами и разделом друзей | код |
| 9 | `task-09-pair-report.md` | разбор пары на странице пары, предложение личного разбора партнёру | код |
| 10 | `task-10-card-offer.md` | карточка «инструкция по применению меня», оферта, ссылки в подвале | код |
| 11 | `task-11-e2e-pr.md` | сквозные сценарии оплаты, итоговые проверки, PR | код + выкладка |

## Карта файлов

```
packages/core/src/reports.ts  reports.test.ts        виды разборов, что открывает покупка, canBuy
packages/core/src/queues.ts                          (+ generate, report_ready)
packages/content/src/labels.ts  labels.test.ts       подписи черт и глав (из apps/web/src/lib/result-view.ts)
packages/content/src/friends.ts  friends.test.ts     compareFriendAnswers (из apps/web/src/server/friends-service.ts)
packages/db/drizzle/0002_*.sql
packages/db/src/schema.ts                            (+ purchases, reports)
packages/db/src/purchases.ts  purchases.test.ts
packages/db/src/reports.ts  reports.test.ts
packages/db/src/results.ts                           (+ getResult)
packages/ai/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts
  src/sections.ts  sections.test.ts                  zod-схемы разделов
  src/input.ts  input.test.ts                        вход из блоков
  src/fallback.ts  fallback.test.ts                  разбор без ИИ
  src/prompt.ts  prompt.test.ts
  src/validate.ts  validate.test.ts
  src/generate.ts  generate.test.ts
  src/providers/yandex.ts  yandex.test.ts
  src/providers/gigachat.ts  gigachat.test.ts
apps/web/src/server/payments/gateway.ts              типы шлюза
apps/web/src/server/payments/yookassa.ts  yookassa.test.ts
apps/web/src/server/payments/fake.ts  fake.test.ts
apps/web/src/server/payments/ip.ts  ip.test.ts
apps/web/src/server/payments-service.ts  payments-service.test.ts
apps/web/src/server/queue.ts                         (+ enqueueGenerate)
apps/web/src/server/env.ts                           (+ платёжные переменные)
apps/web/src/server/friends-service.ts               (+ задача раздела друзей)
apps/web/src/app/api/purchases/route.ts
apps/web/src/app/api/purchases/[id]/route.ts
apps/web/src/app/api/yookassa/notification/route.ts
apps/web/src/app/api/dev/pay/[id]/route.ts
apps/web/src/app/dev/pay/[id]/page.tsx
apps/web/src/lib/report-view.ts  report-view.test.ts
apps/web/src/components/BuyButton.tsx  PurchaseStatus.tsx  AutoRefresh.tsx
apps/web/src/app/result/[id]/ReportOffer.tsx
apps/web/src/app/purchases/[id]/page.tsx
apps/web/src/app/report/[resultId]/page.tsx
apps/web/src/app/pair/[id]/PairReport.tsx
apps/web/src/app/cards/manual/[resultId]/route.tsx
apps/web/src/lib/card.tsx                            (+ карточка «инструкция»)
apps/web/src/app/offer/page.tsx
apps/worker/src/generate.ts  generate.test.ts
apps/worker/src/ai.ts  ai.test.ts                    выбор провайдера по окружению
apps/worker/src/notify.ts  texts.ts                  (+ report_ready)
e2e/purchase.spec.ts
```

## Не входит в план 5

- Настоящие ключи, проверка оплаты в тестовом и боевом магазине, чек в «Мой налог», корневой сертификат для GigaChat — план 6 (выкладка).
- Автоматический возврат денег через API: возврат делается вручную (см. Global Constraints).
- Удаление данных, страницы под поиск, Метрика — план 6.
