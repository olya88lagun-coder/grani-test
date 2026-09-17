# План 2 — Контент: вопросы, библиотека блоков и тексты

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Пакет `@grani/content`: 50 вопросов IPIP на русском с ключами, сверенными с первоисточником, 20 формулировок для друзей, стоп-список опасных тем, проверяемая библиотека из 234 блоков текста (черты, страницы черт, 16 типов, уточнения, пары, уровни совместимости) и её сборка в JSON — всё вычитано владелицей.

**Architecture:** Код и тексты разделены. Тексты — обычные Markdown-файлы в `packages/content/blocks/`, ключи блока закодированы в пути (`traits/openness/high/strengths.md`), поэтому frontmatter и парсер не нужны. Список всех ожидаемых файлов и их лимиты длины задаёт `src/keys.ts`; `src/check.ts` проверяет файлы на диске (наличие, длина, стоп-слова); скрипт `scripts/build-library.mjs` собирает блоки в `src/generated/library.json`, который валидируется zod-схемой и читается через типизированные функции доступа. Вопросы и ключи — TS-данные в `src/items.ts`; идентификаторы вопросов друзей совпадают с идентификаторами вопросов о себе, поэтому баллы владельца «по тем же вопросам» считаются `scoreItems(FRIEND_ITEMS, ответыВладельца)` из `@grani/core`.

**Tech Stack:** как в плане 1 + zod 4.6.5 (как в wishlist).

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` (разделы 3.1, 3.3, 4.1, 4.4 — стоп-список, 4.6 — блоки пар, 9 — подготовка текстов)
**Предыдущий план:** `docs/superpowers/plans/2026-09-16-plan-1-core/` (выполнен, PR #1)
**Дорожная карта:** `docs/superpowers/plans/00-roadmap.md`

## Global Constraints

- Путь проекта `C:\dev\grani-test`, remote `https://github.com/olya88lagun-coder/grani-test` (приватный). Ветка плана — `feat/content`: от `master`, если PR #1 уже влит, иначе от `feat/core`. PR в `master` — после согласия пользователя и после мержа PR #1.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`.
- Имя пакета `@grani/content`; зависит только от `@grani/core` и `zod`. Точки входа: `.` (чистые данные и функции, безопасно для браузера), `./check` (работа с файлами, только тесты и скрипты), `./data` (готовая библиотека из JSON, только сервер).
- Вопросы IPIP-50 — общественное достояние (ipip.ori.org). Соответствие черт: I Extraversion → `extraversion`, II Agreeableness → `agreeableness`, III Conscientiousness → `conscientiousness`, IV Emotional Stability → `stability`, V Intellect/Imagination → `openness`.
- Вопросы для друзей: 4 на черту, 2 прямых и 2 обратных, те же `id`, что у вопросов о себе; в тексте плейсхолдер `{name}` строго в именительном падеже.
- **Правила текстов (все блоки):**
  - личные блоки — на «ты», блоки пар и совместимости — на «вы»; настоящее время;
  - **без родовых форм**: не «ты спокоен/спокойна», «ты сделал(а)», «уверенный в себе» — перестраивать фразу («тебе спокойно», «ты делаешь», «ты уверенно держишься»);
  - низкий полюс черты — стиль, а не недостаток; слепые зоны мягко и с подсказкой «что с этим делать»;
  - без диагнозов, лечения и лекарств, самоповреждения, оценок внешности (проверяет стоп-список);
  - без MBTI и других брендов, без «научно доказано» и без цифр из исследований;
  - без эмодзи; списки через `- ` допустимы; подзаголовки `## ` — только в `types/*/long.md`.
- **Лимиты длины (символы после обрезки пробелов):** блок черты 200–1500; вступление страницы черты 300–2000; тип short 150–600, long 1500–6000; уточнение 200–1500; блок пары 200–1500; фраза совместимости 20–160, текст уровня 200–1500.
- Черновики текстов пишет исполнитель; **каждая группа текстов коммитится только после того, как пользователь прочитал и одобрил** (или внесены его правки).
- Строки в репозитории — LF (`.gitattributes`).
- Коммиты — conventional commits, без Co-Authored-By.

## Задачи

| # | Файл | Что делает | Тип |
|---|---|---|---|
| 1 | `task-01-items.md` | пакет, `.gitattributes`, 50 вопросов о себе и 20 для друзей, проверка ключей | код |
| 2 | `task-02-safety.md` | стоп-список опасных тем `findStopWords` | код |
| 3 | `task-03-library.md` | список файлов и лимиты, проверка файлов, сборщик JSON, zod-схема, функции доступа | код |
| 4 | `task-04-types-texts.md` | утверждение названий, 16 типов (short, long), 2 уточнения — 34 блока | тексты + вычитка |
| 5 | `task-05-trait-texts.md` | 105 блоков черт и 10 вступлений страниц черт | тексты + вычитка |
| 6 | `task-06-pair-texts.md` | 75 блоков пар и 10 текстов уровней совместимости | тексты + вычитка |
| 7 | `task-07-build.md` | сборка `library.json`, `getLibrary`, итоговые проверки, покрытие, PR | код + выкладка |

## Карта файлов

```
.gitattributes
vitest.config.ts                       (покрытие + packages/content)
packages/content/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts                         реэкспорт чистой части
  src/items.ts        items.test.ts    SELF_ITEMS, FRIEND_ITEMS, friendItemText
  src/safety.ts       safety.test.ts   STOP_PATTERNS, findStopWords
  src/keys.ts         keys.test.ts     секции, варианты, LIMITS, LIBRARY_FILES, limitFor, typeCodeToDir
  src/check.ts        check.test.ts    BLOCKS_DIR, normalizeBlock, checkBlockText, checkBlockFiles
  src/library.ts      library.test.ts  LibrarySchema, parseLibrary, функции доступа
  src/data.ts         data.test.ts     getLibrary (JSON)
  src/blocks-types.test.ts             проверка группы типов и уточнений (задача 4)
  src/blocks-traits.test.ts            проверка группы черт (задача 5)
  src/blocks-pairs.test.ts             проверка группы пар (задача 6)
  src/generated/library.json           собранная библиотека (коммитится)
  scripts/build-library.mjs  build-library.d.mts
  blocks/traits/<trait>/<high|low|borderline>/<section>.md           105
  blocks/trait-pages/<trait>/<high|low>.md                             10
  blocks/types/<p|m ×4>/<short|long>.md                                32
  blocks/stability/<calm|sensitive>.md                                  2
  blocks/pairs/<trait>/<both_high|both_low|different>/<section>.md     75
  blocks/compatibility/<level>/<phrase|text>.md                        10
```

## Не входит в план 2

- Цвета и символы карточек типов — план 3 (карточки).
- Страницы сайта, которые показывают эти тексты, — планы 3 и 6.
- Промпты ИИ и сборка разбора из блоков — план 5 (использует `getLibrary` и `findStopWords` отсюда).
- 5–10 статей под поиск — план 6.
