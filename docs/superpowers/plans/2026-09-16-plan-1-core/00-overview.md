# План 1 — Ядро: монорепо и расчёты `packages/core`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Каркас pnpm-монорепо и пакет `@grani/core` со всеми расчётами продукта — баллы по чертам, тип и уточнение, пограничные значения, сравнение с друзьями, совместимость пары и её уровни, варианты пары по черте, прайс, — покрытыми тестами не меньше чем на 80%.

**Architecture:** `packages/core` — чистые функции без ввода-вывода и без знания о текстах вопросов: ключи вопросов (черта, обратный ли) приходят параметром, их источник — `packages/content` из плана 2. Все остальные пакеты будут импортировать расчёты только отсюда, поэтому границы и пороги из спецификации проверяются тестами на граничных значениях.

**Tech Stack:** Node ≥ 24, pnpm 12.4.1, TypeScript 6.0.3, Vitest 5.0.0 + @vitest/coverage-v8 (та же версия, что Vitest), @types/node 26.5.1. Версии совпадают с проектом `C:\dev\wishlist`.

**Spec:** `docs/superpowers/specs/2026-09-16-grani-test-design.md` (разделы 3.1–3.3, 4.3, 4.6, 5.1, 7)
**Дорожная карта:** `docs/superpowers/plans/00-roadmap.md`

## Global Constraints

- Путь проекта: `C:\dev\grani-test`, основная ветка `master`. Работа плана — в ветке `feat/core`, мерж в `master` после зелёных тестов и согласия пользователя.
- Команды pnpm в Git Bash: перед `pnpm ...` выполнить `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"`.
- Имена пакетов: `@grani/core` (в следующих планах `@grani/content`, `@grani/db`, `@grani/ai`, `@grani/web`, `@grani/worker`).
- Импорты внутри пакетов без расширений (`moduleResolution: Bundler`), модули ESM (`"type": "module"`).
- `packages/core` не импортирует ничего, кроме стандартной библиотеки: ни БД, ни сети, ни файловой системы.
- Функции не меняют входные данные: результат — новый объект.
- Баллы черт — целые 0–100. Порог типа: балл ≥ 50 — полюс `+`, < 50 — `-`. Пограничный балл: 45–55 включительно. Уровень черты: > 55 — `high`, < 45 — `low`, иначе `borderline`. Уточнение: стабильность ≥ 50 — `calm`, < 50 — `sensitive`.
- Друзья: сравнение доступно при ≥ 3 ответах; разница заметна, если `|diff| > 15`.
- Совместимость: `round(0.5 × среднее(A_a, A_b, S_a, S_b) + 0.5 × среднее(100 − |O_a − O_b|, 100 − |E_a − E_b|, 100 − |C_a − C_b|))`. Уровни: 85–100, 75–84, 60–74, 45–59, 0–44. Вариант пары по черте: `|a − b| > 25` — `different`; иначе среднее ≥ 50 — `both_high`, < 50 — `both_low`.
- Цены (копейки): полный разбор 29 900, глава 9 900, все главы 24 900, разбор пары 39 900.
- Тесты: Vitest, стиль AAA, имена тестов описывают поведение. Покрытие `packages/core` ≥ 80% по строкам, ветвям и функциям.
- Коммиты — conventional commits, без Co-Authored-By.

## Задачи

| # | Файл | Что делает |
|---|---|---|
| 1 | `task-01-scaffold.md` | монорепо, `@grani/core`, Vitest с порогом покрытия, список черт |
| 2 | `task-02-scoring.md` | `scoreItems` — баллы 0–100 по ключам вопросов |
| 3 | `task-03-types.md` | код типа, уточнение, пограничность, уровни черт, названия 16 типов |
| 4 | `task-04-friends.md` | среднее друзей и сравнение с порогами |
| 5 | `task-05-compatibility.md` | процент совместимости, уровни, варианты пары |
| 6 | `task-06-pricing.md` | продукты, цены, формат суммы; финальная проверка покрытия и мерж |

## Карта файлов

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  vitest.config.ts
.gitignore  .editorconfig
packages/core/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts            реэкспорт
  src/traits.ts           TRAITS, Trait, TraitScores
  src/traits.test.ts
  src/scoring.ts          Answer, ItemKey, scoreItems
  src/scoring.test.ts
  src/types.ts            TypeCode, typeCodeOf, stabilityOf, isBorderline, traitLevel, TYPE_NAMES, typeName, ALL_TYPE_CODES
  src/types.test.ts
  src/friends.ts          MIN_FRIENDS, FRIEND_DIFF_THRESHOLD, averageScores, compareWithFriends
  src/friends.test.ts
  src/compatibility.ts    compatibilityScore, compatibilityLevel, pairVariant
  src/compatibility.test.ts
  src/pricing.ts          PRODUCT_PRICES, Product, isProduct, formatRub
  src/pricing.test.ts
```

## Не входит в план 1

- Тексты вопросов и их ключи (план 2) — ядро принимает ключи параметром.
- Всё, что связано с БД, сайтом, ИИ и оплатой (планы 3–6).
- Git remote и CI: подключаются в плане 3, когда появится что собирать в образы.
