# Task 6: Блоки пар и уровни совместимости — 85 блоков

**Files:**
- Test: `packages/content/src/blocks-pairs.test.ts`
- Create: `packages/content/blocks/pairs/<trait>/<both_high|both_low|different>/<section>.md` — 75 файлов
- Create: `packages/content/blocks/compatibility/<level>/<phrase|text>.md` — 10 файлов

**Interfaces:**
- Consumes: `BLOCKS_DIR`, `checkBlockFiles`, `LIBRARY_FILES`, `COMPATIBILITY_LEVEL_IDS` (Task 3); `readBlock`, `styleProblems` (Task 4).
- Produces: блоки для разбора пары (план 5) и тексты уровней для страницы пары (план 4).

## Как писать

Все тексты — **на «вы»**, о паре: «оба», «один из вас», «вам обоим». Никаких «он/она» и «партнёр/партнёрша» с полом.

| Секция | Раздел разбора пары |
|---|---|
| `similar` | В чём вы похожи |
| `differences` | Где разные и как это использовать |
| `conflicts` | Откуда будут конфликты и как договариваться |
| `home_money` | Быт и деньги |
| `support` | Как поддерживать друг друга |

Варианты по черте:
- `both_high` — у обоих черта выражена;
- `both_low` — у обоих черта слабо выражена;
- `different` — разница больше 25 баллов: «одному из вас…, другому…». Не указывать, кто именно — текст читают оба.

Для `similar` при `different` писать о том, что сходство по этой черте невелико, но есть общая точка (например, оба могут договориться о правилах). Для `differences` при `both_high`/`both_low` — о небольших оттенках внутри похожего стиля.

Каждый блок заканчивается практичным советом, начинающимся с «Попробуйте: …».

**Уровни совместимости** (`compatibility/<level>/`):

| Уровень | Баллы | Тон |
|---|---|---|
| `excellent` | 85–100 | много общего и ресурса, главное — не принимать это как данность |
| `high` | 75–84 | хорошая основа, пара мест, где стоит договариваться |
| `good` | 60–74 | «вам есть над чем работать, и это решаемо» |
| `effort` | 45–59 | разные ритмы, отношения требуют осознанных договорённостей |
| `challenging` | 0–44 | много различий; различия — не приговор, это про внимание и правила, а не про «не подходите» |

- `phrase.md` (20–160) — одна фраза под процентом.
- `text.md` (200–1500) — 2 абзаца: что значит уровень и на что обратить внимание. В одном из абзацев — фраза, что это не прогноз отношений.

**Образец `pairs/extraversion/different/differences.md`:**
```
Одному из вас нужны люди и движение, другому — тишина и время наедине с собой. Это не проблема, если не пытаться переделать друг друга: общительность одного открывает паре новые знакомства, а спокойствие другого создаёт дом, где можно выдохнуть.

Попробуйте: договоритесь заранее, сколько встреч в неделю комфортно обоим, и отпускайте друг друга на «свои» вечера без обид.
```

- [ ] **Step 1: Тест группы (падает)**

`packages/content/src/blocks-pairs.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { TRAITS } from "@grani/core";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const SINGULAR_YOU = /(?<![а-яё])(ты|тебе|тебя|тобой|твой|твоя|твоё|твои)(?![а-яё])/iu;

describe.each(TRAITS)("pair blocks for %s", (trait) => {
  const files = LIBRARY_FILES.filter((file) => file.startsWith(`pairs/${trait}/`));

  test("exist, fit their length limits and avoid stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, `pairs/${trait}/`)).toEqual([]);
  });

  test("follow the style rules, speak to the couple and end with advice", () => {
    for (const file of files) {
      const text = readBlock(file);
      expect(styleProblems(file, text)).toEqual([]);
      expect(text, file).not.toMatch(SINGULAR_YOU);
      expect(text, file).toContain("Попробуйте:");
    }
  });
});

describe("compatibility level texts", () => {
  const files = LIBRARY_FILES.filter((file) => file.startsWith("compatibility/"));

  test("exist, fit their length limits and avoid stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, "compatibility/")).toEqual([]);
  });

  test("follow the style rules and speak to the couple", () => {
    for (const file of files) {
      const text = readBlock(file);
      expect(styleProblems(file, text)).toEqual([]);
      expect(text, file).not.toMatch(SINGULAR_YOU);
    }
  });

  test("remind in every level text that this is not a relationship forecast", () => {
    for (const file of files.filter((candidate) => candidate.endsWith("/text.md"))) {
      expect(readBlock(file), file).toMatch(/не прогноз/iu);
    }
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/blocks-pairs.test.ts
```
Expected: FAIL — по 15 записей `missing` на черту и 10 для уровней совместимости.

- [ ] **Step 3: Уровни совместимости**

Написать 10 файлов `compatibility/…`, затем:
```bash
pnpm vitest run packages/content/src/blocks-pairs.test.ts -t "compatibility level texts"
```
Expected: PASS — 3 теста.

- [ ] **Step 4: Блоки пар по одной черте за раз**

Порядок: `agreeableness`, `stability`, `extraversion`, `conscientiousness`, `openness` (сначала черты, которые сильнее всего влияют на процент). Для каждой — 15 файлов, затем:
```bash
pnpm vitest run packages/content/src/blocks-pairs.test.ts -t "pair blocks for <trait>"
```
Expected: PASS — 2 теста этой черты.

- [ ] **Step 5: Вычитка пользователем**

Собрать файлы для чтения — уровни совместимости отдельно, пары по чертам — и отправить пользователю (SendUserFile):
```bash
cd packages/content/blocks
{ for f in compatibility/*/phrase.md compatibility/*/text.md; do printf '\n\n---\n\n# %s\n\n' "$f"; cat "$f"; done; } \
  > "$TMP/grani-review-compatibility.md"
T=agreeableness
{ for f in pairs/$T/*/*.md; do printf '\n\n---\n\n# %s\n\n' "$f"; cat "$f"; done; } > "$TMP/grani-review-pairs-$T.md"
```
Внести правки, повторить тесты.

- [ ] **Step 6: Итоговый прогон группы**

```bash
pnpm vitest run packages/content/src/blocks-pairs.test.ts
```
Expected: PASS — 13 тестов (2 × 5 черт + 3).

- [ ] **Step 7: Коммит после одобрения**

```bash
git add packages/content/src/blocks-pairs.test.ts packages/content/blocks/pairs packages/content/blocks/compatibility
git commit -m "feat(content): couple blocks and compatibility level texts"
```
