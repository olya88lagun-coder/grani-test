# Task 4: Названия типов, 16 типов и уточнения — 34 блока

**Files:**
- Test: `packages/content/src/blocks-texts.ts` (общий помощник проверок групп), `packages/content/src/blocks-types.test.ts`
- Create: `packages/content/blocks/types/<dir>/short.md`, `packages/content/blocks/types/<dir>/long.md` — 16 каталогов
- Create: `packages/content/blocks/stability/calm.md`, `packages/content/blocks/stability/sensitive.md`
- Modify (только если пользователь меняет названия): `packages/core/src/types.ts`, `packages/core/src/types.test.ts`, `docs/superpowers/specs/2026-09-16-grani-test-design.md` (таблица 3.2)

**Interfaces:**
- Consumes: `BLOCKS_DIR`, `checkBlockFiles` (Task 3); `TYPE_NAMES`, `ALL_TYPE_CODES` из `@grani/core`; `typeCodeToDir`, `LIBRARY_FILES` (Task 3).
- Produces:
  ```ts
  // blocks-texts.ts — используется тестами задач 4–6
  function readBlock(file: string): string; // нормализованный текст файла из BLOCKS_DIR
  function styleProblems(file: string, text: string): string[]; // бренды, скобочные родовые окончания, заголовки не на месте
  ```

## Каталоги типов

| Код | Каталог | Тип | Код | Каталог | Тип |
|---|---|---|---|---|---|
| `++++` | `pppp` | Вдохновитель | `-+++` | `mppp` | Опора |
| `+++-` | `pppm` | Реформатор | `-++-` | `mppm` | Командир |
| `++-+` | `ppmp` | Созидатель | `-+-+` | `mpmp` | Тихий хранитель |
| `++--` | `ppmm` | Архитектор | `-+--` | `mpmm` | Мастер |
| `+-++` | `pmpp` | Искра | `--++` | `mmpp` | Душа компании |
| `+-+-` | `pmpm` | Бунтарь | `--+-` | `mmpm` | Игрок |
| `+--+` | `pmmp` | Мечтатель | `---+` | `mmmp` | Тихая гавань |
| `+---` | `pmmm` | Изобретатель | `----` | `mmmm` | Наблюдатель |

Порядок полюсов в коде: открытость, добросовестность, экстраверсия, доброжелательность.

## Как писать

- **`short.md`** (150–600 символов) — бесплатный результат, на «ты», 3–4 предложения: суть сочетания черт, как человек выглядит для других, где раскрывается лучше всего. Без заголовков и списков.
- **`long.md`** (1500–6000 символов) — страница под поиск, её читают и люди, которые ещё не проходили тест, поэтому **в третьем лице множественного числа**: «Люди типа «Искра»…». Ровно эти подзаголовки по порядку:
  ```
  ## Какие они
  ## Сильные стороны
  ## Слепые зоны
  ## Работа
  ## Отношения
  ## С кем легко
  ```
  В «С кем легко» — 2–3 типа по названиям, с которыми сочетание черт дополняет друг друга, и одна фраза почему (опора — формула совместимости: высокая доброжелательность и стабильность, похожие открытость, экстраверсия и добросовестность).
- **`stability/calm.md`, `stability/sensitive.md`** (200–1500) — на «ты», как уточнение меняет картину типа: «спокойный» — ровное настроение и устойчивость к стрессу, но риск не замечать сигналы усталости; «чувствительный» — тонкое восприятие и эмпатия, сильнее реакция на стресс, плюс что помогает. Слово «чувствительный» в тексте не использовать в родовой форме — писать «чувствительность», «тебе свойственна».
- Все правила текстов из `00-overview.md` (без родовых форм, стоп-темы, без MBTI, без эмодзи).

**Образец `types/pmpp/short.md`:**
```
Ты зажигаешь людей идеями и лёгкостью. Тебе интересно всё новое, с тобой просто заговорить, и рядом с тобой людям тепло. Планы ты строишь на ходу: вдохновение для тебя важнее расписания. Лучше всего ты раскрываешься там, где можно придумывать, знакомиться и пробовать.
```

- [ ] **Step 1: Утвердить названия с пользователем**

Показать таблицу выше и спросить: оставить названия и женские формы (`TYPE_NAMES` в `packages/core/src/types.ts`) или заменить. Если что-то меняется:
1. Обновить `TYPE_NAMES`.
2. Обновить примеры в `packages/core/src/types.test.ts` (тесты «maps the spec examples» и «feminine form»), если затронуты «Искра», «Тихий хранитель» или «Мечтатель».
3. Обновить таблицу раздела 3.2 спецификации.
4. `pnpm test && pnpm typecheck`, затем:
```bash
git add packages/core/src/types.ts packages/core/src/types.test.ts docs/superpowers/specs/2026-09-16-grani-test-design.md
git commit -m "feat(core): final type names"
```

- [ ] **Step 2: Помощник проверок и тест группы (падает)**

`packages/content/src/blocks-texts.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCKS_DIR, normalizeBlock } from "./check";

const BRAND_PATTERN = /mbti|майерс|бриггс|16personalities|соционик/iu;
const BRACKET_GENDER_PATTERN = /\((?:а|ая|ой|на|ла)\)|[а-яё]\/(?:а|ая|ой)(?![а-яё])/iu;

export function readBlock(file: string): string {
  return normalizeBlock(readFileSync(join(BLOCKS_DIR, ...file.split("/")), "utf8"));
}

export function styleProblems(file: string, text: string): string[] {
  const problems: string[] = [];
  if (BRAND_PATTERN.test(text)) problems.push(`${file}: brand mention`);
  if (BRACKET_GENDER_PATTERN.test(text)) problems.push(`${file}: bracketed gender ending`);
  const hasHeadings = /^## /m.test(text);
  const headingsAllowed = /^types\/[pm]{4}\/long\.md$/.test(file);
  if (hasHeadings && !headingsAllowed) problems.push(`${file}: headings are allowed only in types/*/long.md`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) problems.push(`${file}: emoji`);
  return problems;
}
```

`packages/content/src/blocks-types.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const LONG_HEADINGS = ["## Какие они", "## Сильные стороны", "## Слепые зоны", "## Работа", "## Отношения", "## С кем легко"];

const files = LIBRARY_FILES.filter((file) => file.startsWith("types/") || file.startsWith("stability/"));

describe("type and stability blocks", () => {
  test("exist, fit their length limits and avoid stop topics", () => {
    expect([...checkBlockFiles(BLOCKS_DIR, "types/"), ...checkBlockFiles(BLOCKS_DIR, "stability/")]).toEqual([]);
  });

  test("follow the style rules", () => {
    expect(files.flatMap((file) => styleProblems(file, readBlock(file)))).toEqual([]);
  });

  test("long type pages use exactly the agreed headings in order", () => {
    for (const file of files.filter((candidate) => candidate.endsWith("/long.md"))) {
      const headings = readBlock(file)
        .split("\n")
        .filter((line) => line.startsWith("## "));
      expect(headings, file).toEqual(LONG_HEADINGS);
    }
  });
});
```

- [ ] **Step 3: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/blocks-types.test.ts
```
Expected: FAIL — 34 записи `{ problem: "missing" }` в диффе.

- [ ] **Step 4: Черновики `short.md` для 16 типов и двух уточнений**

Написать 18 файлов по правилам выше. Запустить тест группы:
```bash
pnpm vitest run packages/content/src/blocks-types.test.ts
```
Expected: FAIL, но в диффе первого теста остаются только 16 записей `types/*/long.md: missing`; строк `too short`, `too long`, `stop word` нет. Второй и третий тесты падают только из-за отсутствующих `long.md` (ошибка чтения файла).

- [ ] **Step 5: Черновики `long.md` для 16 типов**

Написать 16 файлов. Запустить весь тест группы:
```bash
pnpm vitest run packages/content/src/blocks-types.test.ts
```
Expected: PASS — 3 теста.

- [ ] **Step 6: Вычитка пользователем**

Собрать группу в один файл для чтения и отправить пользователю (SendUserFile):
```bash
cd packages/content/blocks
{ for f in stability/*.md types/*/short.md types/*/long.md; do printf '\n\n---\n\n# %s\n\n' "$f"; cat "$f"; done; } \
  > "$TMP/grani-review-types.md"
```
Попросить отметить: что звучит неестественно, где неточно по смыслу, какие формулировки обидны. Внести правки, повторить Step 5.

- [ ] **Step 7: Коммит после одобрения**

```bash
git add packages/content/src/blocks-texts.ts packages/content/src/blocks-types.test.ts packages/content/blocks/types packages/content/blocks/stability
git commit -m "feat(content): type descriptions and stability notes"
```
