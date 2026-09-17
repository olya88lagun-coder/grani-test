# План 3 — Тест и вход: сайт, прохождение теста, вход и бесплатный результат

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Работающий локально сайт grani-test.ru: первый экран, тест из 50 вопросов с сохранением прогресса, вход через Telegram или VK ID с согласием на обработку данных, сохранённый результат с типом, уточнением, шкалами и коротким описанием, картинка-карточка «мой тип» для сторис, CI на GitHub.

**Architecture:** Как в wishlist. `packages/db` — Drizzle-схема (users, auth_identities, results), репозитории и тесты на PGlite. `apps/web` — Next.js 16 (App Router, standalone): тонкие route handlers поверх тестируемых серверных сервисов в `src/server/`. Ответы теста живут в `localStorage` до конца теста; `POST /api/results` сохраняет результат сразу, если человек вошёл, или кладёт ответы в подписанную httpOnly-cookie `grani_pending`, которую читает обработчик входа. Согласие на обработку данных ставится отдельной галочкой: `POST /api/consent` выдаёт подписанную cookie `grani_consent`, без которой вход не создаёт нового пользователя. Карточка «мой тип» не содержит личных данных и рисуется по коду типа: `GET /cards/<каталог типа>` → PNG 1080×1920 через `next/og`.

**Tech Stack:** как в планах 1–2 + Next.js 16.3.5, React 19.3.0, Drizzle ORM 0.45.2, drizzle-kit 0.31.10, postgres 3.4.9, @electric-sql/pglite 0.5.8 и pglite-socket 0.2.11, jose 6.2.12, @playwright/test 1.63.0 — версии как в `C:\dev\wishlist`.

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` (разделы 2.1 шаги 1–4, 3.1–3.2, 4.5 — карточка «мой тип», 5.1–5.3 — вход и сессия, 6 — согласие)
**Предыдущий план:** `docs/superpowers/plans/2026-09-17-plan-2-content/` (выполнен, PR #2)
**Образец кода:** `C:\dev\wishlist` — вход Telegram и VK ID, сессии, PGlite, Dockerfile, CI проверены в проде; при переносе сохранять поведение, менять только имена и то, что отличается по спецификации.

## Global Constraints

- **Значения проекта:** `APP_DOMAIN` = `grani-test.ru`; `APP_URL` = `https://grani-test.ru` (локально `http://localhost:3000`); `TELEGRAM_BOT_USERNAME` = `test_grani_bot`, `VK_CLIENT_ID` = `54776443` (приложение VK ID создано, redirect `https://grani-test.ru/api/auth/vk/callback`); локально `VK_CLIENT_ID=1` — вход VK на localhost не работает, как и Telegram-виджет; git remote `https://github.com/olya88lagun-coder/grani-test.git`; путь `C:\dev\grani-test`.
- Ветка плана `feat/test-login` от `master` после мержа PR #2. PR в `master` — после зелёного CI и согласия пользователя.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`.
- Имена пакетов: `@grani/db`, `@grani/web`. Сессионные и служебные cookie: `grani_session` (httpOnly, Secure, SameSite=Lax, 30 дней), `grani_pending` (httpOnly, Secure, SameSite=Lax, 1 день), `grani_consent` (httpOnly, Secure, SameSite=Lax, 1 час), `grani_vk_oauth` (httpOnly, Secure, SameSite=Lax, path `/api/auth/vk`, 10 минут). На `http://localhost` флаг Secure не ставится.
- Все POST, меняющие состояние, проверяют `Origin` == `APP_URL`.
- Вход только Telegram Login Widget (без Mini App) и VK ID (OAuth 2.1 + PKCE, хост `https://id.vk.ru`). Привязка второго способа входа к тому же профилю в первой версии не делается: вход через другой сервис — другой пользователь.
- **Согласие:** версия `CONSENT_VERSION = "2026-09-v1"`. Новый пользователь создаётся только при валидной cookie согласия; время и версия согласия сохраняются в `users`.
- Персональные данные только в РФ: база в проде — на сервере Timeweb (план 6); в этом плане — PGlite локально и в тестах.
- Секреты только в `.env` на сервере, в GitHub Secrets и в `apps/web/.env.development.local` (не коммитится); в репозитории — `apps/web/.env.development.example` без реальных токенов.
- Страницы сайта в этом плане закрыты от индексации (`robots: noindex`) — индексация включается в плане 6.
- Визуальный стиль — `docs/design/visual-direction.md` (выбран в Task 1): кремовая «бумага», плоские тонированные панели без теней, Cormorant Garamond 300 + Golos Text, три палитры по разделам через `data-palette`. Цвета и шрифты берутся только из CSS-переменных.
- Тесты: Vitest (AAA, имена описывают поведение), сервисы и репозитории — с PGlite; сквозной сценарий — Playwright на локальном приложении. Покрытие `packages/*/src` и `apps/web/src/server` ≥ 80%.
- **Каждое действие вне репозитория (создание ботов и приложений, DNS, GitHub Settings) делает пользователь**; агент ждёт подтверждения и значений без секретов.
- Коммиты — conventional commits, без Co-Authored-By.

## Предварительные действия пользователя (до Task 6)

Нужны для настоящего входа; до Task 6 работа идёт с dev-входом.

1. **Telegram-бот:** в @BotFather `/newbot` → имя «Грани», username `test_grani_bot` (создан) → токен сохранить у себя. `/setdomain` → `grani-test.ru` (для Login Widget).
2. **VK ID:** на `https://id.vk.ru/business/go` создать приложение (Web) → `client_id`; доверенный Redirect URL `https://grani-test.ru/api/auth/vk/callback`; базовый домен `grani-test.ru`.
3. **DNS:** A-запись `grani-test.ru` → `200.169.178.231` (выкладка — план 6, но запись можно завести заранее).
4. Передать агенту: username бота и `client_id` VK (токен бота — только в `.env` самостоятельно).
5. **До Task 8:** ФИО оператора персональных данных (как в «Мой налог») и почта для запросов по данным — для текста согласия.

Локально Telegram-виджет на `localhost` не работает — для разработки и E2E используется dev-вход (`DEV_LOGIN=1`), как в wishlist.

## Задачи

| # | Файл | Что делает | Тип |
|---|---|---|---|
| 1 | `task-01-visual.md` | визуальное направление: палитра, шрифты, цвета и символы 16 типов | с пользователем |
| 2 | `task-02-db.md` | `@grani/db`: схема, миграции, PGlite, пользователи, согласие, результаты | код |
| 3 | `task-03-web-scaffold.md` | `@grani/web`: Next.js, env, база, health, стили, dev-БД, CI | код |
| 4 | `task-04-auth-primitives.md` | подписи Telegram, VK ID PKCE, JWT-токены сессии, состояния, ожидающих ответов, согласия | код |
| 5 | `task-05-results-service.md` | проверка ответов, расчёт результата, сохранение или отложенное сохранение, ограничение частоты | код |
| 6 | `task-06-login.md` | согласие, вход Telegram и VK, dev-вход, выход, маршруты | код |
| 7 | `task-07-test-ui.md` | первый экран и страница теста с прогрессом в `localStorage` | код |
| 8 | `task-08-result-pages.md` | страница входа, результат, `/me`, текст согласия | код |
| 9 | `task-09-card.md` | карточка «мой тип» 1080×1920 | код |
| 10 | `task-10-e2e-pr.md` | сквозной сценарий Playwright, итоговые проверки, PR | код + выкладка |

## Карта файлов

```
.github/workflows/ci.yml
.gitignore                                   (+ .dev-db/, test-results/, playwright-report/)
package.json                                 (dev:db, dev:web, test:e2e)
vitest.config.ts                             (покрытие db и web/server)
docs/design/visual-direction.md              (Task 1)
e2e/playwright.config.ts  e2e/test-flow.spec.ts
packages/db/
  package.json  tsconfig.json  vitest.config.ts  drizzle.config.ts
  drizzle/                                   сгенерированные миграции
  scripts/migrate.mjs  scripts/dev-db.mjs
  src/index.ts  schema.ts  client.ts  types.ts  testing.ts
  src/users.ts  users.test.ts                upsertUserFromIdentity, recordConsent, getUser
  src/results.ts  results.test.ts            createResult, getResultForOwner, getLatestResultId
apps/web/
  package.json  tsconfig.json  next.config.ts  vitest.config.ts  .env.development.example
  public/.gitkeep
  src/app/layout.tsx  globals.css  page.tsx
  src/app/test/page.tsx  src/app/test/TestRunner.tsx
  src/app/login/page.tsx  LoginPanel.tsx  TelegramLoginButton.tsx
  src/app/result/[id]/page.tsx  ShareCard.tsx
  src/app/me/page.tsx
  src/app/consent/page.tsx
  src/app/cards/[dir]/route.tsx
  src/app/api/health/route.ts
  src/app/api/results/route.ts
  src/app/api/consent/route.ts
  src/app/api/auth/telegram/widget/route.ts
  src/app/api/auth/vk/start/route.ts  src/app/api/auth/vk/callback/route.ts
  src/app/api/auth/logout/route.ts
  src/app/api/dev/login/route.ts
  src/components/ScaleBar.tsx
  src/server/env.ts  env.test.ts  db.ts  http.ts  http.test.ts  deps.ts
  src/server/auth/telegram.ts  telegram.test.ts
  src/server/auth/vk.ts  vk.test.ts
  src/server/auth/tokens.ts  tokens.test.ts
  src/server/rate-limit.ts  rate-limit.test.ts
  src/server/results-service.ts  results-service.test.ts
  src/server/login-service.ts  login-service.test.ts
  src/server/dev-login.ts  dev-login.test.ts
  src/server/viewer.ts  login-response.ts
  src/lib/test-progress.ts  test-progress.test.ts
  src/lib/result-view.ts  result-view.test.ts
  src/lib/login-errors.ts  login-errors.test.ts
  src/lib/legal.ts
  src/lib/type-visuals.ts  type-visuals.test.ts
  src/lib/card.tsx  card.test.tsx
```

## Не входит в план 3

- Приглашения друзей и партнёра, уведомления, воркер — план 4.
- Оплата, превью платного разбора, ИИ, карточка «инструкция» — план 5.
- Страницы под поиск, политика конфиденциальности и оферта в финальной редакции, cookie-баннер и Метрика, удаление данных, Docker-образы и деплой — план 6.
