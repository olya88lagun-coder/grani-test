# Task 7: Сборка библиотеки, `getLibrary`, итоговые проверки и PR

**Files:**
- Create: `packages/content/src/generated/library.json` (генерируется)
- Create: `packages/content/src/data.ts`
- Test: `packages/content/src/data.test.ts`
- Delete: `packages/content/blocks/.gitkeep`
- Modify: `package.json` (корневой скрипт), `docs/superpowers/plans/2026-09-17-plan-2-content/00-overview.md` (статус)

**Interfaces:**
- Consumes: `collectLibrary` (Task 3), `parseLibrary`, `Library`, `typeTexts` (Task 3), `BLOCKS_DIR`, `checkBlockFiles` (Task 3), все блоки (Tasks 4–6).
- Produces:
  ```ts
  // "@grani/content/data" — только сервер
  function getLibrary(): Library; // парсит library.json один раз и кеширует
  ```
  Корневой скрипт `pnpm build:library`.

- [ ] **Step 1: Тест (падает)**

`packages/content/src/data.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { ALL_TYPE_CODES } from "@grani/core";
import { collectLibrary } from "../scripts/build-library.mjs";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { getLibrary } from "./data";
import raw from "./generated/library.json";
import { typeTexts } from "./library";

describe("built library", () => {
  test("has every block file present, within limits and free of stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, "")).toEqual([]);
  });

  test("library.json matches blocks/ — run `pnpm build:library` after editing texts", () => {
    expect(raw).toEqual(collectLibrary(BLOCKS_DIR));
  });

  test("parses and serves texts for every type", () => {
    const library = getLibrary();

    for (const code of ALL_TYPE_CODES) expect(typeTexts(library, code).short.length).toBeGreaterThan(0);
  });

  test("parses the JSON only once", () => {
    expect(getLibrary()).toBe(getLibrary());
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/data.test.ts
```
Expected: FAIL — `Failed to resolve import "./generated/library.json"`.

- [ ] **Step 3: Скрипт и сборка**

В корневой `package.json` в `scripts` добавить:
```json
    "build:library": "pnpm --filter @grani/content build:library"
```

```bash
rm packages/content/blocks/.gitkeep
pnpm build:library
```
Expected: `library.json written: …\packages\content\src\generated\library.json`.

- [ ] **Step 4: Реализация**

`packages/content/src/data.ts`:
```ts
import raw from "./generated/library.json";
import { parseLibrary, type Library } from "./library";

let cached: Library | undefined;

export function getLibrary(): Library {
  cached ??= parseLibrary(raw);
  return cached;
}
```

- [ ] **Step 5: Все проверки**

```bash
pnpm test && pnpm typecheck && pnpm test:coverage
```
Expected:
- все тесты зелёные: план 1, `items`, `safety`, `keys`, `check`, `library`, три группы блоков, `data`;
- typecheck без ошибок;
- покрытие `packages/core/src` и `packages/content/src` ≥ 80% по строкам, ветвям, функциям и инструкциям.

- [ ] **Step 6: Сверка со спецификацией**

Проверить по разделам спецификации:
- 3.1 — 50 вопросов IPIP-50, ключи сверены с ipip.ori.org (тест `items.test.ts`);
- 3.3 — 20 вопросов для друзей, по 2 прямых и 2 обратных на черту, те же вопросы, что у владельца;
- 4.1 — блоки для 5 черт × 3 уровня × 7 секций, `short` и `long` для 16 типов, оба уточнения, страницы уровней черт;
- 4.4 — стоп-список (диагнозы, лечение и лекарства, самоповреждение, внешность);
- 4.6 — блоки пар 5 × 3 × 5 и тексты 5 уровней совместимости.

Отметить в `00-overview.md` строкой под заголовком: `> **Статус: выполнен YYYY-MM-DD.**` с числом тестов и покрытием.

```bash
git add package.json packages/content docs/superpowers/plans/2026-09-17-plan-2-content/00-overview.md
git commit -m "feat(content): build library.json and serve it via getLibrary"
```

- [ ] **Step 7: PR — только после согласия пользователя**

Показать пользователю итог: число тестов, покрытие, `git log --oneline origin/master..feat/content`. Если PR #1 ещё не влит, предупредить, что PR 2 будет показывать и коммиты плана 1, и предложить сначала влить PR #1. После явного «да»:

```bash
git push -u origin feat/content
gh pr create --base master --head feat/content --title "feat(content): вопросы IPIP, библиотека текстов (план 2)" --body-file <файл с описанием>
```
В описании PR: что сделано по задачам 1–7, результаты `pnpm test`, `pnpm typecheck`, `pnpm test:coverage`, отметка, что все тексты вычитаны пользователем, и что CI появится в плане 3.
