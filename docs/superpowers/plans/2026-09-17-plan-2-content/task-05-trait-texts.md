# Task 5: Блоки черт и страницы черт — 115 блоков

**Files:**
- Test: `packages/content/src/blocks-traits.test.ts`
- Create: `packages/content/blocks/traits/<trait>/<high|low|borderline>/<section>.md` — 105 файлов
- Create: `packages/content/blocks/trait-pages/<trait>/<high|low>.md` — 10 файлов

**Interfaces:**
- Consumes: `BLOCKS_DIR`, `checkBlockFiles`, `LIBRARY_FILES`, `TRAIT_SECTIONS` (Task 3); `readBlock`, `styleProblems` (Task 4).
- Produces: блоки, из которых план 5 собирает полный разбор и главы, а план 6 — страницы уровней черт.

## Что куда идёт

| Секция | Где используется | Форма |
|---|---|---|
| `strengths` | «Сильные стороны» полного разбора | 2–3 пункта `- ` |
| `blind_spots` | «Слепые зоны» полного разбора | 2 пункта `- `, каждый заканчивается «Что с этим делать: …» |
| `work` | портрет, страница типа | абзац + «Что помогает: …» |
| `relationships` | глава «Отношения», портрет | абзац + «Что помогает: …» |
| `money` | глава «Деньги» | абзац + «Что помогает: …» |
| `conflict` | глава «Конфликты», «Инструкция: как со мной ссориться» | абзац + «Что помогает: …» |
| `stress` | глава «Стресс», «Инструкция: что меня бесит» | абзац + «Что помогает: …» |

Уровни:
- `high` — балл выше 55, `low` — ниже 45: описывать проявления полюса;
- `borderline` — 45–55: «в тебе есть черты обоих полюсов», от чего зависит, какой проявится, как этим пользоваться.

Черта `stability` на `low` — это чувствительность, а не «нестабильность»; на `high` — устойчивость. Черта `openness` на `low` — практичность и опора на проверенное, а не «ограниченность».

**`trait-pages/<trait>/<high|low>.md`** (300–2000) — вступление страницы под поиск «Высокая/низкая <черта>», в третьем лице множественного числа («люди с высокой добросовестностью»): что означает уровень, как проявляется в жизни, 2–3 абзаца, без заголовков.

**Образец `traits/conscientiousness/low/work.md`:**
```
В работе тебе ближе гибкость, чем жёсткий регламент. Ты хорошо справляешься, когда задача меняется на ходу, и не теряешься, если план приходится переписывать. Длинные однообразные процессы даются тяжелее: внимание уходит к чему-то новому.

Что помогает: делить большие задачи на короткие отрезки с понятным результатом, договариваться о сроках вслух и держать один простой список дел вместо сложной системы.
```

- [ ] **Step 1: Тест группы (падает)**

`packages/content/src/blocks-traits.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { TRAITS } from "@grani/core";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const files = LIBRARY_FILES.filter((file) => file.startsWith("traits/") || file.startsWith("trait-pages/"));

describe.each(TRAITS)("%s blocks", (trait) => {
  const traitFiles = files.filter((file) => file.split("/")[1] === trait);

  test("exist, fit their length limits and avoid stop topics", () => {
    expect([
      ...checkBlockFiles(BLOCKS_DIR, `traits/${trait}/`),
      ...checkBlockFiles(BLOCKS_DIR, `trait-pages/${trait}/`),
    ]).toEqual([]);
  });

  test("follow the style rules", () => {
    expect(traitFiles.flatMap((file) => styleProblems(file, readBlock(file)))).toEqual([]);
  });

  test("use bullet lists for strengths and blind spots and advice elsewhere", () => {
    for (const file of traitFiles.filter((candidate) => candidate.startsWith("traits/"))) {
      const text = readBlock(file);
      if (file.endsWith("/strengths.md")) {
        expect(text.split("\n").filter((line) => line.startsWith("- ")).length, file).toBeGreaterThanOrEqual(2);
      } else if (file.endsWith("/blind_spots.md")) {
        expect(text.match(/Что с этим делать:/g)?.length ?? 0, file).toBeGreaterThanOrEqual(2);
      } else {
        expect(text, file).toContain("Что помогает:");
      }
    }
  });
});
```

`describe.each` по чертам даёт отдельный результат на каждую черту — по нему видно, какая черта уже готова.

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/blocks-traits.test.ts
```
Expected: FAIL — по 23 записи `missing` на каждую из 5 черт.

- [ ] **Step 3: Черновики по одной черте за раз**

Порядок: `conscientiousness`, `extraversion`, `agreeableness`, `openness`, `stability`. Для каждой черты написать 21 блок `traits/<trait>/…` и 2 файла `trait-pages/<trait>/…`, затем:
```bash
pnpm vitest run packages/content/src/blocks-traits.test.ts -t "<trait> blocks"
```
Expected: PASS — 3 теста этой черты. Перейти к следующей черте только после зелёного результата.

- [ ] **Step 4: Вычитка пользователем по чертам**

Для каждой готовой черты собрать файл для чтения и отправить пользователю (SendUserFile):
```bash
cd packages/content/blocks
T=conscientiousness
{ for f in trait-pages/$T/*.md traits/$T/*/*.md; do printf '\n\n---\n\n# %s\n\n' "$f"; cat "$f"; done; } \
  > "$TMP/grani-review-$T.md"
```
Внести правки, повторить тест черты. Вычитывать можно пачкой по 2–3 черты, если пользователю так удобнее.

- [ ] **Step 5: Итоговый прогон группы**

```bash
pnpm vitest run packages/content/src/blocks-traits.test.ts
```
Expected: PASS — 15 тестов (3 × 5 черт).

- [ ] **Step 6: Коммит после одобрения всех пяти черт**

```bash
git add packages/content/src/blocks-traits.test.ts packages/content/blocks/traits packages/content/blocks/trait-pages
git commit -m "feat(content): trait blocks and trait page intros"
```
