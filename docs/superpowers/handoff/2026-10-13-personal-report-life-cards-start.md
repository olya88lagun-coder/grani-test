# Задание для нового чата: «В жизни» и памятка в платном личном разборе (шаг 1)

Скопируй этот файл целиком в первое сообщение нового чата (или скажи: «прочитай docs/superpowers/handoff/2026-10-13-personal-report-life-cards-start.md и продолжай»).

## Что нужно сделать

Довести до кода шаг 1 переделки платного «Личного разбора»: вкладка «В жизни» с пятью карточками, написанными ИИ под человека, и «живая» памятка во вкладке «Мой итог».

- **Спецификация утверждена владельцем («ок»):** `docs/superpowers/specs/2026-10-13-personal-report-life-cards-design.md`, ветка `docs/personal-report-life-cards` (запушена, PR не открыт).
- **Следующий шаг: написать план реализации** (скилл `superpowers:writing-plans`) в `docs/superpowers/plans/2026-10-13-personal-report-life-cards.md`, показать владельцу и получить подтверждение плана и способа выполнения. Код до подтверждения не писать.
- Выполнение: **сам, по месту, без субагентов** (`superpowers:executing-plans`), TDD, один финальный разбор всей ветки самим собой.

## Контекст в двух словах

Платный разбор (299 ₽) состоит из вкладок «Портрет», «Пять граней», «В жизни», «Мой итог», «4 сферы». Главы («Деньги», «Конфликты», «Стресс», «Отношения») уже переведены на карточки, которые пишет YandexGPT: темы-«семена», три запроса, проверки и повторы с замечаниями модели. Теперь то же нужно для «В жизни» (пять жизненных ситуаций) и для эпиграфа памятки. Сейчас «В жизни» статично (`ATLAS_COPY.scenarios`), а в памятке стоит пустая фраза «Полезный подход — тот, который помогает в моей конкретной ситуации».

## Карта кода (найдено при подготовке плана)

**Где перебираются виды отчётов (нужно явно решить для `life`):**
- `packages/core/src/reports.ts`: `REPORT_KINDS`, `reportKindsFor`, `unlockedKinds`, `canBuy`. `life` не продукт; открывается вместе с оплаченным `full`.
- `packages/core/src/queues.ts`: тип `GenerateJob`, `generateJobKey`.
- `packages/db/src/schema.ts:261`: enum `report_kind` строится из `REPORT_KINDS` — нужна аддитивная миграция (`ALTER TYPE … ADD VALUE`), смотри `packages/db/` на формат миграций и тесты миграций (они бывают медленными).
- `packages/ai/src/prompt.ts` (`SHAPES: Record<ReportKind, …>`), `sections.ts` (`SECTION_SCHEMAS`, `ReportSections`, `parseSections`), `fallback.ts`, `generate.ts`, `validate.ts`: исчерпывающие по `ReportKind`, компилятор подскажет все места.
- `apps/worker/src/texts.ts`: `READY_TITLES: Record<ReportKind, string>` и уведомление «отчёт готов»: для `life` уведомление **не должно** уходить.
- `apps/web/src/server/payments-service.ts`: `jobsFor`, `enqueuePaid`, `getPurchaseView`. **Ловушка:** `getPurchaseView` считает `ready`, сверяя все задачи `jobsFor` с готовыми отчётами; если добавить `life` в `jobsFor`, страница ожидания оплаты будет вечно ждать карточки. `life` должна ставиться отдельно и в `ready` не входить.

**Переиспользовать (главы):** `packages/ai/src/chapter-cards.ts` (`validateSituations`, `RepeatGuard`, `blockTexts`, правила подсказки, `reviewStyle`), `generate-chapter.ts` (`runPart`, `CARD_ATTEMPTS = 5`, `withFix`, мягкая последняя попытка), `chapter-style.ts` (оговорки, род `gendered`, `genderedForms`), `chapter-overlap.ts` (`repeatsAny`), `packages/content/src/chapter-seeds.ts` (формат тем), `apps/worker/src/generate.ts` (`runGenerate`, `usesCards`), `apps/worker/src/env.ts` (флаг `CHAPTER_CARDS_V2`, по образцу — `LIFE_CARDS_V1`), `apps/web/src/components/ChapterCards.tsx` (вёрстка карточек), `apps/web/src/lib/chapter-cover.ts` (`seedIconPath`, пути иконок), `packages/ai/src/testing.ts` (`cardsStubWriter`, `sampleSituation`; их `partOf` определяет часть по первой теме, для `life` понадобится обобщение).

**Что менять на вкладках:**
- `apps/web/src/components/personality-atlas/PersonalEdition.tsx` (вкладка `life`, компонент `AtlasScenarios` в `AtlasPractices.tsx`, статика в `atlas-copy.ts`).
- `apps/web/src/lib/personality-atlas.ts` (`buildPersonalityAtlas`, `memo.quote`/`items`) и `apps/web/src/server/personality-atlas-service.ts` (`initialAtlasData(model)` — добавить необязательный аргумент с карточками; сохранённый черновик не трогать никогда).
- `apps/web/src/lib/report-view.ts` и `apps/web/src/app/report/[resultId]/page.tsx` (где грузятся отчёты и откуда берутся данные страницы; ленивая постановка задачи при открытии).
- Блоки для входа модели: смотри `packages/content/src/keys.ts` (`TRAIT_SECTIONS`) и как `buildPersonalInput` собирает блоки для `full`; решить, из каких секций берутся блоки для `life`.

## Как работаем (договорённости с владельцем)

- Язык общения: русский, коротко, без воды; владелец не программист: объяснять понятно, команды на сервер давать готовыми однострочниками, по одной, в блоках кода.
- **В `master` не вливать без явной команды** («вливай»): слияние в `master` запускает выкладку на боевой сайт. Перед слиянием дождаться проверок PR, после слияния — зелёного `deploy`.
- Каждое изменение: ветка → TDD (тест сначала, увидеть падение) → полный `pnpm test` и `pnpm typecheck` → PR с честным разделом «Не проверено» → ждать команды.
- Тексты, видимые пользователям, утверждает владелец; нейтральный род («ты открыт» нельзя), без утверждений о прошлом читателя, без диагнозов.
- Серверные операции (БД, воркер) делает владелец по готовым командам; `docker exec -i food-tracker-bot-db-1 psql -U grani -d grani …`, воркер `grani-worker-1`, подробности в памяти `prod-ops-recreate-chapter`. Данные других пользователей без отдельного разрешения не трогать.
- Новые картинки рисует GPT по техзаданию (образец: `docs/redesign/GPT_CHAPTER_ICONS_V3.md`): для `life` нужно пять золотых значков `public/life/<seed>.webp`, 480×480, прозрачный фон, до 40 КБ, один предмет без искр, без обручальных колец.

## Технические подсказки (чтобы не терять время)

- Windows + Git Bash: длинные скрипты через heredoc иногда ломаются; пиши их в файл (инструмент записи) и запускай `PYTHONIOENCODING=utf-8 python file.py`. Регулярки с `\s` в Python-скриптах писать через `String.raw` в TS-файле.
- Локально: `pnpm dev:db`, затем `PERSONALITY_ATLAS_V2=1 MONEY_PRACTICE_V1=1 CHAPTER_CARDS_V2=1 pnpm dev:web`; тестовый пользователь `/api/dev/login?name=Paid`, результат `64da99f5-c74c-4c3d-94e5-44de1be990f9`. Скрипты Playwright импортировать по полному пути из `node_modules/.pnpm/playwright@…`.
- Два теста миграций БД (`practice-upgrade`, `personality-atlas-upgrade`) иногда падают по таймауту только при параллельном прогоне: запусти их отдельно, прежде чем считать это ошибкой.
- Живую генерацию YandexGPT локально не проверить (ИИ выключен); проверка идёт на сервере по логу: `docker logs --since 10m grani-worker-1 | grep -iE "chapter|report generated"`. Пометки в логе: `chapter part rejected` (+`detail`), `chapter part accepted with remarks` (+`forgiven`), `report generated` (`source: ai | fallback`).
- Повторная постановка задачи с тем же id блокируется, пока pg-boss хранит завершённую; для ручного повтора старую завершённую задачу удаляют из `pgboss.job`.

## Что уже сделано и влито (для ориентира)

Карточки глав и иконки (#127, #136, #137), компас «Деньги» (#131), кнопка компаса в главе (#132), диагностика и мягкие проверки генерации (#133, #135, #139, #141, #142). Глава «Деньги» на аккаунте владельца пока осталась в старом тексте: пересоздание сделает отдельно по её просьбе.

## Открытые вопросы владельца (не блокируют шаг 1)

- Контраст кнопок «Открыть за 99 ₽» и «Скачать» (2.19:1) и вкладка «Пять граней»: светлая или тёмная бумага.
- Шаг 2 («Портрет»: убрать дубль с бесплатным результатом, разбить на короткие блоки) и шаг 3 («Пять граней») — отдельные спецификации после шага 1.
- Резервные таблицы `reports_backup*` на сервере (семь штук): команда на удаление дана, ждёт решения владельца.
