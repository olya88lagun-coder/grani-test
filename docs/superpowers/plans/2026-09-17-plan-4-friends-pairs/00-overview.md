# План 4 — Друзья и пары: «как меня видят другие», совместимость, уведомления

> **Статус: выполнен 2026-09-21.** 381 тест + 6 сквозных (Playwright, с работающим воркером); покрытие: строки 92,8%, выражения 91,3%, функции 89,3%, ветви 89,0%. Сборки сайта и воркера без предупреждений. Уведомления проверены в режиме dry run; настоящие — после выкладки (план 6). Сообщество создано 2026-09-22: https://vk.ru/club241664000.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Владелец результата отправляет друзьям ссылку, друзья без входа отвечают на 20 вопросов, после трёх ответов на странице результата открывается сравнение «как меня видят другие». Вошедший пользователь зовёт партнёра по одноразовой ссылке; партнёр проходит тест (или берёт свой последний результат), входит и даёт отдельное согласие — появляется страница пары с совместимостью, из пары можно выйти. О новых ответах друзей и созданной паре приходит сообщение в Telegram или ВКонтакте — через новый `apps/worker` на pg-boss.

**Architecture:** Как в плане 3 и в wishlist. `packages/db` получает таблицы `invites`, `friend_responses`, `pair_invites`, `pairs` и флаг `auth_identities.can_notify` со своими репозиториями. `apps/web` — тонкие маршруты поверх тестируемых сервисов `friends-service.ts` и `pairs-service.ts`, чистые модели отображения в `src/lib/`. Опросник теста обобщается до компонента `Questionnaire`, которым пользуются и тест о себе, и анкета друга. Уведомления: `apps/web` только ставит задачу в очередь pg-boss (`notify`), `apps/worker` читает базу, собирает текст и отправляет через Telegram Bot API или `messages.send` сообщества ВКонтакте; отказ платформы снимает `can_notify`. Разрешение на сообщения ВКонтакте приходит событием Callback API `message_allow` на `POST /api/vk/callback`.

**Tech Stack:** как в плане 3 + pg-boss 12.31.1, grammy 1.46.0, esbuild 0.28.2 (сборка воркера) — версии как в `C:\dev\wishlist`.

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` — разделы 2.1 шаг 4 (блок друзей и кнопка пары), 2.2, 2.3, 3.3, 4.6 (кроме платного разбора пары), 5.2 (`invites`, `friend_responses`, `pair_invites`, `pairs`, `can_notify`), 5.3 «Уведомления», 6 «Совместимость», 7 «Пары».
**Дизайн:** `docs/design/visual-direction.md` — разделы друзей в палитре «Туман» (`data-palette="friends"`), пары — в «Глине» (`data-palette="pair"`).
**Предыдущий план:** `docs/superpowers/plans/2026-09-17-plan-3-test-login/` (выполнен, PR #3)
**Образец кода:** `C:\dev\wishlist` — `apps/worker` (pg-boss, `telegram/messenger.ts`, `jobs.ts`, `scripts/build.mjs`), `apps/web/src/server/queue.ts`.

## Global Constraints

- Ветка плана `feat/friends-pairs` от `master` после мержа PR #3. PR в `master` — после зелёного CI и согласия пользователя.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`.
- Имена пакетов: `@grani/db`, `@grani/web`, новый `@grani/worker`. Очередь pg-boss `notify`; имена очередей и типы задач — в `packages/core/src/queues.ts`.
- **Анонимность друзей** (спецификация 2.3): ответы отдельных друзей не показываются и не отдаются ни одним маршрутом — только среднее и только при `MIN_FRIENDS` = 3 и больше. Свои ответы владельца друзья не видят. С одного браузера по одной ссылке — один ответ: `device_hash = HMAC-SHA256(SESSION_SECRET, "device:" + метка)`, метка — случайный UUID в httpOnly-cookie `grani_device` (1 год). В базе хранится только хеш.
- Владелец не может ответить на анкету по своей ссылке (проверка по сессии).
- На странице друга показывается только имя владельца (первое слово `display_name`), без типа и шкал.
- **Пары** (спецификация 4.6, 6, 7): пара создаётся только при отмеченной галочке согласия партнёра; пригласивший не принимает своё приглашение; ссылка одноразовая (переход `open → accepted` одним условным `UPDATE`); между двумя людьми одна активная пара; после выхода любой из двоих получает 404 на странице пары и не видит пару в списке. Партнёру берётся его последний результат на момент согласия.
- Совместимость и тексты уровней — только из `@grani/core` (`compatibilityScore`, `compatibilityLevel`) и `@grani/content` (`compatibilityTexts`); на странице пары дисклеймер «это не прогноз отношений». Платный разбор пары — план 5.
- Токены приглашений: 18 случайных байт в base64url (24 символа), проверка формата `^[A-Za-z0-9_-]{24}$` до обращения к базе.
- Cookie плана: `grani_device` (httpOnly, SameSite=Lax, 1 год), `grani_pair` (токен приглашения партнёра, httpOnly, SameSite=Lax, 1 день). Secure — только на https, как в плане 3.
- Все POST, меняющие состояние, проверяют `Origin` == `APP_URL`; ответы друзей и создание приглашений ограничены по частоте.
- **Уведомления:** web ставит задачу и не ждёт отправки; ошибка очереди логируется и не ломает действие пользователя. Воркер отправляет только адресам с `can_notify = true`; отказ Telegram (403/400) или ВКонтакте (код 901/902) ставит `can_notify = false`; временная ошибка — повтор pg-boss. Одна и та же задача не ставится дважды: id задачи pg-boss выводится из `notifyJobKey`; повтор задачи после частичной отправки не делается — воркер повторяет только если никому ничего не ушло. Тексты без родовых окончаний.
- Telegram-вход через виджет с `request-access=write` сразу даёт право писать: новая Telegram-идентичность создаётся с `can_notify = true`. ВКонтакте — `false` до события `message_allow`.
- `VK_GROUP_ID` = `241664000` (сообщество https://vk.ru/club241664000). Не секрет.
- Переменные окружения, добавляемые планом, необязательны: без `VK_GROUP_ID`/`VK_GROUP_TOKEN`/`VK_CALLBACK_SECRET`/`VK_CONFIRMATION_CODE` ВКонтакте-уведомления и Callback API выключены, без `TELEGRAM_BOT_TOKEN` в воркере — Telegram-уведомления.
- Визуальный стиль — `docs/design/visual-direction.md`; цвета только из CSS-переменных; палитры через `data-palette`.
- Тесты: Vitest (AAA, имена описывают поведение), репозитории и сервисы — с PGlite; сквозные сценарии — Playwright на локальном приложении с dev-входом. Покрытие `packages/*/src`, `apps/web/src/server`, `apps/web/src/lib`, `apps/worker/src` ≥ 80%.
- **Каждое действие вне репозитория (сообщество ВКонтакте, ключи, Callback API, GitHub Settings) делает пользователь**; агент ждёт подтверждения и значений без секретов.
- Коммиты — conventional commits, без Co-Authored-By. Ответы пользователю — по-русски.

## Предварительные действия пользователя (до Task 7)

Нужны только для уведомлений ВКонтакте; задачи 1–6 от них не зависят.

1. **Сообщество ВКонтакте «Грани»:** vk.com → «Сообщества» → «Создать сообщество» → тип «Тематическое сообщество» или «Бизнес». В «Управление → Сообщения» включить сообщения сообщества.
2. **Ключ доступа:** «Управление → Работа с API → Ключи доступа → Создать ключ» с правом «Сообщения сообщества». Ключ — только в `.env` на сервере, агенту не присылать.
3. **Callback API** (настраивается после выкладки, план 6): «Работа с API → Callback API» → версия API 5.199, адрес `https://grani-test.ru/api/vk/callback`, секретный ключ (придумать, в `.env`); во вкладке «Типы событий» включить «Разрешение на получение сообщений», «Запрет на получение сообщений», «Входящее сообщение». Строку подтверждения со страницы — в `.env` как `VK_CONFIRMATION_CODE`.
4. Передать агенту: **ID сообщества** (число) — не секрет.

## Задачи

| # | Файл | Что делает | Тип |
|---|---|---|---|
| 1 | `task-01-db.md` | миграция: приглашения, ответы друзей, приглашения и пары, `can_notify`; репозитории | код |
| 2 | `task-02-questionnaire.md` | общий опросник для теста и анкеты друга, прогресс с размером экрана и ключом хранения | код |
| 3 | `task-03-friends-service.md` | ссылка для друзей, метка устройства, приём и проверка 20 ответов, сравнение ≥ 3 | код |
| 4 | `task-04-friends-pages.md` | страница друга `/f/[token]`, блок «Как тебя видят другие» на странице результата | код |
| 5 | `task-05-pairs-service.md` | приглашение партнёра, возврат после теста и входа, согласие, выход из пары | код |
| 6 | `task-06-pairs-pages.md` | страница приглашения `/p/[token]`, страница пары `/pair/[id]`, блок пар на странице результата | код |
| 7 | `task-07-worker.md` | `apps/worker`: очередь `notify`, Telegram и ВКонтакте, тексты, постановка задач из web | код |
| 8 | `task-08-vk-callback.md` | Callback API ВКонтакте, кнопка «Разрешить сообщения», переменные окружения | код + пользователь |
| 9 | `task-09-e2e-pr.md` | сквозные сценарии друга и пары, итоговые проверки, PR | код + выкладка |

## Карта файлов

```
package.json                                   (dev:worker)
vitest.config.ts                               (покрытие apps/worker/src)
.github/workflows/ci.yml                       (без изменений: воркер входит в typecheck и test)
e2e/friends.spec.ts  e2e/pairs.spec.ts
packages/core/src/queues.ts  queues.test.ts    очереди и задачи уведомлений
packages/db/drizzle/0001_*.sql
packages/db/src/schema.ts                      (+ invites, friend_responses, pair_invites, pairs, can_notify)
packages/db/src/tokens.ts  tokens.test.ts      формат токенов приглашений
packages/db/src/invites.ts  invites.test.ts
packages/db/src/pairs.ts  pairs.test.ts
packages/db/src/notify-targets.ts  notify-targets.test.ts
packages/db/src/users.ts                       (can_notify при создании Telegram-идентичности)
apps/web/src/lib/test-progress.ts              (размер экрана параметром)
apps/web/src/components/Questionnaire.tsx      (из app/test/TestRunner.tsx)
apps/web/src/lib/friends-view.ts  friends-view.test.ts
apps/web/src/lib/pair-view.ts  pair-view.test.ts
apps/web/src/server/device.ts  device.test.ts
apps/web/src/server/friends-service.ts  friends-service.test.ts
apps/web/src/server/pairs-service.ts  pairs-service.test.ts
apps/web/src/server/queue.ts
apps/web/src/server/vk-callback.ts  vk-callback.test.ts
apps/web/src/server/http.ts                    (+ DEVICE_COOKIE, PAIR_COOKIE)
apps/web/src/server/env.ts                     (+ необязательные VK_*)
apps/web/src/server/login-service.ts           (возврат к приглашению партнёра)
apps/web/src/app/test/page.tsx
apps/web/src/app/f/[token]/page.tsx  FriendQuestionnaire.tsx
apps/web/src/app/api/invites/route.ts
apps/web/src/app/api/f/[token]/route.ts
apps/web/src/app/result/[id]/page.tsx  FriendsBlock.tsx  PairsBlock.tsx  InviteLink.tsx
apps/web/src/app/p/[token]/page.tsx  AcceptPairForm.tsx
apps/web/src/app/pair/[id]/page.tsx
apps/web/src/app/api/pairs/invites/route.ts
apps/web/src/app/api/pairs/join/route.ts
apps/web/src/app/api/pairs/accept/route.ts
apps/web/src/app/api/pairs/[id]/leave/route.ts
apps/web/src/app/api/vk/callback/route.ts
apps/web/src/components/VkAllowMessages.tsx
apps/worker/
  package.json  tsconfig.json  vitest.config.ts  scripts/build.mjs
  src/main.ts  env.ts  env.test.ts  log.ts
  src/telegram.ts  telegram.test.ts
  src/vk.ts  vk.test.ts
  src/texts.ts  texts.test.ts
  src/notify.ts  notify.test.ts
```

## Не входит в план 4

- Платный разбор «как тебя видят друзья» и разбор пары, оплата — план 5.
- Удаление данных (в том числе удаление пары вместе с данными партнёра), Docker-образ воркера, выкладка и настоящая проверка уведомлений на телефоне — план 6.
- Бот Telegram с командами и ответами на сообщения: воркер только отправляет уведомления.
