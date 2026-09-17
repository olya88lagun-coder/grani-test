# Task 2: Стоп-список опасных тем

**Files:**
- Create: `packages/content/src/safety.ts`
- Test: `packages/content/src/safety.test.ts`
- Modify: `packages/content/src/index.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  type StopTopic = "diagnosis" | "medication" | "self_harm" | "appearance";
  const STOP_PATTERNS: readonly { readonly topic: StopTopic; readonly pattern: RegExp }[];
  function findStopWords(text: string): StopTopic[]; // темы без повторов, в порядке STOP_PATTERNS
  ```

Раздел 4.4 спецификации: разбор не принимается, если в тексте есть диагнозы, лекарства и лечение, самоповреждение или оценки внешности. Этот же список проверяет заготовленные блоки (задачи 4–6) и ответы ИИ (план 5). Шаблоны ищут основы слов без `\b`: в JavaScript `\b` не работает с кириллицей. Список намеренно консервативный — ложное срабатывание на заготовленном блоке исправляется переформулировкой, а пропуск опасного текста хуже.

- [ ] **Step 1: Тест (падает)**

`packages/content/src/safety.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { findStopWords } from "./safety";

describe("findStopWords", () => {
  test.each([
    ["Похоже, у тебя депрессия.", "diagnosis"],
    ["Это признаки расстройства личности.", "diagnosis"],
    ["Такой профиль бывает при СДВГ.", "diagnosis"],
    ["Тебе стоит поставить себе диагноз.", "diagnosis"],
    ["Попробуй антидепрессанты.", "medication"],
    ["Выпей успокоительные таблетки.", "medication"],
    ["Это лечится лекарствами.", "medication"],
    ["Мысли о суициде нормальны.", "self_harm"],
    ["Иногда хочется навредить себе.", "self_harm"],
    ["Твоя внешность отталкивает людей.", "appearance"],
    ["Сбрось лишний вес, и станет легче.", "appearance"],
  ] as const)("flags %j as %s", (text, topic) => {
    expect(findStopWords(text)).toContain(topic);
  });

  test.each([
    "Ты любишь порядок и держишь слово.",
    "Тебе важно, чтобы рядом было спокойно.",
    "В конфликте ты сначала слушаешь, а потом отвечаешь.",
    "Когда накапливается усталость, помогает пауза и прогулка.",
    "Вы по-разному отдыхаете, и это можно обсудить заранее.",
    "У вас общие увлечения, и это сближает.",
  ])("does not flag %j", (text) => {
    expect(findStopWords(text)).toEqual([]);
  });

  test("is case-insensitive and reports each topic once", () => {
    expect(findStopWords("ДИАГНОЗ и снова диагноз, а ещё Таблетки")).toEqual(["diagnosis", "medication"]);
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/safety.test.ts
```
Expected: FAIL — `Failed to resolve import "./safety"`.

- [ ] **Step 3: Реализация**

`packages/content/src/safety.ts`:
```ts
export type StopTopic = "diagnosis" | "medication" | "self_harm" | "appearance";

export const STOP_PATTERNS: readonly { readonly topic: StopTopic; readonly pattern: RegExp }[] = [
  {
    topic: "diagnosis",
    pattern:
      /диагноз|расстройств|депресси|биполяр|шизофрен|сдвг|аутизм|аутичн|психопат|социопат|нарциссическ|пограничн(?:ое|ого|ым) расстройств|невроз|психоз/iu,
  },
  {
    topic: "medication",
    pattern: /лекарств|(?<!ув)лечени|(?<!ув)лечит|таблетк|антидепрессант|транквилизатор|успокоительн|препарат|дозировк|рецепт врача/iu,
  },
  {
    topic: "self_harm",
    pattern: /суицид|самоубийств|самоповрежд|навредить себе|причинить себе вред|покончить с собой|свести счёты/iu,
  },
  {
    topic: "appearance",
    pattern: /внешност|некрасив|лишний вес|лишнего веса|толст(?:ый|ая|ые|еть)|худ(?:ой|ая|ые)|уродлив|фигур(?:а|ы|у|ой) у тебя/iu,
  },
];

export function findStopWords(text: string): StopTopic[] {
  return STOP_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ topic }) => topic);
}
```

`packages/content/src/index.ts`:
```ts
export * from "./items";
export * from "./safety";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/content/src/safety.ts packages/content/src/safety.test.ts packages/content/src/index.ts
git commit -m "feat(content): stop list for diagnoses, medication, self-harm and appearance"
```
