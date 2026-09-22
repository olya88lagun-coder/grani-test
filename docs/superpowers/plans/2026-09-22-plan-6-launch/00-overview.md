# План 6 — Запуск: документы, удаление данных, страницы под поиск, Метрика, выкладка

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Сайт grani-test.ru работает на VPS и открыт для поиска. На нём есть финальные документы (политика, согласие, оферта, контакты и описание услуг для ЮKassa) и кнопка «Удалить мои данные». Работают 16 страниц типов, 10 страниц уровней черт, страница совместимости пары и 5 статей, а также `sitemap.xml` и `robots.txt`. Яндекс.Метрика с целями загружается только после согласия в cookie-баннере. После ручной проверки на телефоне работают настоящая оплата ЮKassa с чеком «Мой налог», ИИ, вход через Telegram и VK ID и уведомления.

**Architecture:** Документы и подвал собраны в `apps/web/src/lib/legal.ts` и общем компоненте `Footer`, который подключён в `layout.tsx`. Удаление данных делает одна транзакция `deleteUserData` в `packages/db`. Она удаляет результаты (каскадом уходят ссылки для друзей, ответы друзей, приглашения, пары и разборы), удаляет способы входа и ставит `users.deleted_at`. Покупки остаются, их ссылки на результат или пару обнуляются. Страницы под поиск генерируются статически из `packages/content`. Адреса страниц заданы в `apps/web/src/lib/seo.ts`, этот же файл используют `sitemap.ts` и перелинковка. Статьи — markdown-файлы в `packages/content/articles/` с zod-проверкой при сборке. Метрику подключает клиентский компонент `Analytics`: баннер хранит выбор в `localStorage`, а цели отправляются через `reachGoal`, который до согласия ничего не делает. Выкладка повторяет wishlist: один `Dockerfile` с целями `web`, `worker`, `migrate`, образы в GHCR, `docker compose` на общем VPS, отдельный блок в Caddy трекера и workflow `deploy.yml` с проверкой после выкладки.

**Tech Stack:** как в плане 5, новых npm-зависимостей нет (заголовок статьи разбирается вручную, см. задачу 4). Docker, GitHub Actions (`docker/build-push-action@v6`), Caddy трекера питания.

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` — разделы 1 (п. 8 — страницы под поиск), 5.3 «Страницы под поиск» и «Аналитика», 5.4, 6, 7 («Сквозные тесты», «Вручную перед запуском»), 9.
**Дизайн:** `docs/design/visual-direction.md` — все новые страницы в палитре «Оранжерея», кроме страницы совместимости пары (`data-palette="pair"`).
**Предыдущий план:** `docs/superpowers/plans/2026-09-22-plan-5-paid-reports/` (выполнен, PR #5)
**Образец выкладки:** `C:\dev\wishlist\apps\web\Dockerfile`, `C:\dev\wishlist\deploy\`, `C:\dev\wishlist\.github\workflows\{images,deploy}.yml`.

## Global Constraints

- Ветка плана `feat/launch` от `master` после мержа PR #5. PR в `master` — после зелёного CI и согласия пользователя. Выкладка начинается с мержа в `master`.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`. После `pnpm add` — `pnpm dedupe`.
- **Индексация:** публичные страницы (`/`, `/types`, `/types/*`, `/traits/*`, `/compatibility`, `/articles`, `/articles/*`, `/privacy`, `/consent`, `/offer`, `/contacts`) — `index, follow`. Всё, что привязано к человеку или ссылке (`/test`, `/login`, `/me`, `/result/*`, `/report/*`, `/pair/*`, `/p/*`, `/f/*`, `/purchases/*`, `/cards/*`, `/dev/*`, `/api/*`), — `noindex` и `Disallow` в `robots.txt`. По умолчанию в `layout.tsx` стоит `noindex`: индексацию включает сама страница через `publicMetadata(...)`.
- Каноничный адрес — `https://grani-test.ru` без завершающего слэша. `metadataBase` берётся из `APP_URL`, а при сборке образа — из `https://grani-test.ru`.
- **Удаление данных** (спецификация 6): удаляются результаты, ответы друзей, приглашения, пары (в том числе пара с партнёром, вместе с разбором пары), разборы и способы входа; пользователю ставится `deleted_at`. Покупки сохраняются для налогового учёта, но без ответов и ссылок. Удаление подтверждается отдельной формой, `POST` проверяет `Origin` и сессию, после удаления сессия сбрасывается.
- **Метрика** загружается только после «Принять» в cookie-баннере. «Только необходимые» — Метрика не загружается совсем. Выбор хранится в `localStorage` (`grani-cookie-consent` = `all` | `necessary`) и меняется ссылкой «Настройки cookie» в подвале. Цели — ровно `test_start`, `test_finish`, `login`, `invite_shared`, `friend_answered`, `purchase_full`, `purchase_chapter` (спецификация 5.3), плюс `pair_invite_shared` и `purchase_pair` для воронки пары (спецификация 8). Вебвизор выключен: он записывает ввод на страницах с ответами теста.
- **Документы:** в политике, согласии и оферте должно быть сказано, что оплату проводит ЮKassa, текст разбора готовит сервис ИИ (YandexGPT или GigaChat) по баллам без имени, уведомления приходят через Telegram и ВКонтакте, а Яндекс.Метрика работает только с согласия. Хранение данных — в России (VPS Timeweb, Москва). Новая редакция согласия — `2026-09-v2`, политики — `2026-09-v1`, оферты — `2026-09-v2`.
- **Контакты для ЮKassa:** ФИО, ИНН самозанятой, e-mail, описание услуг и цены. ИНН не секрет, но значение даёт пользователь. Без него задача 1 не завершается.
- Номер счётчика Метрики и код Яндекс.Вебмастера — константы в коде, как в wishlist. Значения даёт пользователь.
- **Секреты** — только в `/opt/grani/.env` на сервере: токен бота, ключ сообщества ВК, ключи ЮKassa и ИИ, `SESSION_SECRET`, пароль БД. Агенту не присылаются, в репозиторий и логи не попадают. Скомпрометированный токен Telegram из прошлой переписки заменить новым через @BotFather (`/revoke`), прежде чем вписывать его в `.env`.
- **Сервер общий** с трекером питания и wishlist (`root@200.169.178.231`). У трекера трогаем только две вещи: создаём БД и роль `grani` в его Postgres и **дописываем** блок в его `Caddyfile` (правила из `C:\dev\wishlist\deploy\server-setup.md`, раздел «Caddy»). Лимиты памяти: `web` 350m, `worker` 250m.
- **Каждое действие вне репозитория** (сервер, GitHub Settings и Secrets, ЮKassa, Метрика, Вебмастер, @BotFather, VK) делает пользователь. Агент готовит команды и ждёт подтверждения. Команды по SSH агент запускает только с явного разрешения пользователя на каждый шаг, и в них не должно быть секретов.
- Визуальный стиль — `docs/design/visual-direction.md`; цвета только из CSS-переменных.
- Тесты: Vitest (AAA), репозитории — с PGlite, сквозные — Playwright на локальном приложении. Покрытие `packages/*/src`, `apps/web/src/server`, `apps/web/src/lib`, `apps/worker/src` ≥ 80%.
- Коммиты — conventional commits, без Co-Authored-By. Ответы пользователю — по-русски.

## Предварительные действия пользователя

Коду нужны только значения из пунктов 1–3. Остальное понадобится при выкладке (задача 7) и ручной проверке (задача 8).

1. **ИНН самозанятой** — для страницы «Контакты и услуги» (требование ЮKassa).
2. **Яндекс.Метрика:** metrika.yandex.ru → «Добавить счётчик» → сайт `grani-test.ru`, вебвизор выключить. Нужен номер счётчика. Цели код отправляет сам через `reachGoal`, а в интерфейсе Метрики их заводят как «JavaScript-событие» с идентификаторами из Global Constraints.
3. **Яндекс.Вебмастер:** добавить `https://grani-test.ru` → способ подтверждения «Метатег» → прислать значение `content`.
4. **Память VPS до 4 ГБ** (спецификация 5.4): панель Timeweb → сервер → конфигурация.
5. **Telegram:** @BotFather → `/revoke` для бота (прежний токен скомпрометирован) и `/setdomain` → `grani-test.ru` (без этого виджет входа не работает).
6. **VK ID:** в настройках приложения добавить доверенный Redirect URL `https://grani-test.ru/api/auth/vk/callback` и базовый домен `grani-test.ru`.
7. **ЮKassa:** магазин самозанятой, выдача чеков через «Мой налог», тестовый магазин; адрес для уведомлений `https://grani-test.ru/api/yookassa/notification`, событие `payment.succeeded` и `payment.canceled`.
8. **ИИ:** ключ YandexGPT (ID каталога и API-ключ) или ключ авторизации GigaChat.
9. **Роскомнадзор:** уведомление об обработке персональных данных (pd.rkn.gov.ru), до открытия сайта для поиска.
10. **GitHub Secrets** репозитория (`Settings → Secrets and variables → Actions`): `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` — как в wishlist.

## Задачи

| # | Файл | Что делает | Тип |
|---|---|---|---|
| 1 | `task-01-legal.md` | подвал на всех страницах, «Контакты и услуги», политика, согласие v2, оферта v2 | код |
| 2 | `task-02-delete-data.md` | `deleteUserData`, маршрут и страница «Удалить мои данные» | код |
| 3 | `task-03-seo-pages.md` | адреса и метаданные, страницы типов, уровней черт, совместимости, `sitemap.xml`, `robots.txt`, schema.org | код |
| 4 | `task-04-articles.md` | 5 статей: загрузчик и проверка, страницы, вычитка владелицей | код + тексты |
| 5 | `task-05-analytics.md` | cookie-баннер, Метрика после согласия, цели, код Вебмастера | код |
| 6 | `task-06-images.md` | `Dockerfile` (web, worker, migrate), `.dockerignore`, workflow `images.yml` | код |
| 7 | `task-07-deploy.md` | `deploy/` (compose, Caddy, БД, инструкция), `deploy.yml` с проверкой после выкладки, настройка сервера | код + выкладка |
| 8 | `task-08-e2e-launch.md` | сквозные сценарии новых страниц, итоговые проверки, PR, выкладка, ручная проверка на телефоне | код + выкладка |

## Карта файлов

```
apps/web/src/lib/legal.ts                            (+ ИНН, версии документов, список получателей данных)
apps/web/src/components/Footer.tsx                   общий подвал
apps/web/src/app/layout.tsx                          (+ Footer, Analytics, код Вебмастера)
apps/web/src/app/contacts/page.tsx                   контакты и услуги
apps/web/src/app/privacy/page.tsx                    политика обработки ПДн
apps/web/src/app/consent/page.tsx                    (редакция v2)
apps/web/src/app/offer/page.tsx                      (редакция v2)
apps/web/src/server/login-service.ts                 (CONSENT_VERSION = 2026-09-v2)
packages/db/src/delete-user.ts  delete-user.test.ts  deleteUserData
apps/web/src/server/account-service.ts  account-service.test.ts
apps/web/src/app/api/me/delete/route.ts
apps/web/src/app/me/delete/page.tsx  DeleteForm.tsx
apps/web/src/lib/seo.ts  seo.test.ts                 адреса, publicMetadata, JSON-LD
apps/web/src/app/types/page.tsx
apps/web/src/app/types/[slug]/page.tsx
apps/web/src/app/traits/[slug]/page.tsx
apps/web/src/app/compatibility/page.tsx
apps/web/src/app/sitemap.ts  robots.ts
packages/content/articles/*.md                       5 статей
packages/content/src/articles.ts  articles.test.ts   загрузка и проверка статей
apps/web/src/app/articles/page.tsx
apps/web/src/app/articles/[slug]/page.tsx
apps/web/src/lib/analytics.ts  analytics.test.ts     номер счётчика, цели, reachGoal
apps/web/src/components/Analytics.tsx                баннер и загрузка Метрики
apps/web/src/components/Goal.tsx                     цель при показе страницы
Dockerfile  .dockerignore
.github/workflows/images.yml  deploy.yml
deploy/docker-compose.yml  Caddyfile.grani  create-db.sql  server-setup.md  env.example
e2e/launch.spec.ts
```

## Не входит в план 6

- Страницы пар типов (136 страниц), процентили, реклама и партнёрства, маркировка рекламы — вне первой версии (спецификация 1).
- Автоматический возврат через API ЮKassa: возврат делается вручную (план 5).
- Бэкапы базы в S3 (как в wishlist) — отдельный план после запуска. До него перед каждой миграцией в инструкции выкладки делается `pg_dump` на диск сервера.
