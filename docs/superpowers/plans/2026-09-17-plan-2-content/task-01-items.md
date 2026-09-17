# Task 1: Пакет `@grani/content` и вопросы

**Files:**
- Create: `.gitattributes`
- Modify: `vitest.config.ts`
- Create: `packages/content/package.json`, `packages/content/tsconfig.json`, `packages/content/vitest.config.ts`
- Create: `packages/content/src/items.ts`, `packages/content/src/index.ts`
- Test: `packages/content/src/items.test.ts`

**Interfaces:**
- Consumes: `ItemKey`, `Trait`, `TRAITS`, `Answers`, `scoreItems` из `@grani/core` (план 1).
- Produces:
  ```ts
  const NAME_PLACEHOLDER = "{name}";
  type SelfItem = ItemKey & { readonly number: number; readonly text: string; readonly source: string };
  type FriendItem = ItemKey & { readonly text: string }; // text содержит "{name}"
  const SELF_ITEMS: readonly SelfItem[];   // 50, в порядке number 1..50, id "ipip-01".."ipip-50"
  const FRIEND_ITEMS: readonly FriendItem[]; // 20, id — подмножество SELF_ITEMS
  function friendItemText(item: FriendItem, name: string): string;
  ```

Порядок вопросов в тесте — как в IPIP-50 (черты чередуются). Ключи в `items.test.ts` записаны отдельной строкой из таблицы ipip.ori.org, а не вычислены из `items.ts`, — это и есть сверка с источником.

- [ ] **Step 1: Ветка**

```bash
cd /c/dev/grani-test
git fetch origin
git checkout master && git pull --ff-only
# если PR #1 ещё не влит: git checkout feat/core && git pull --ff-only
git checkout -b feat/content
```

- [ ] **Step 2: Окончания строк**

`.gitattributes`:
```
* text=auto eol=lf
```

```bash
git add .gitattributes
git add --renormalize .
git commit -m "chore: normalize line endings to LF"
```

- [ ] **Step 3: Пакет**

`packages/content/package.json`:
```json
{
  "name": "@grani/content",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./check": "./src/check.ts",
    "./data": "./src/data.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "build:library": "node scripts/build-library.mjs"
  },
  "dependencies": {
    "@grani/core": "workspace:*",
    "zod": "4.6.5"
  }
}
```

`packages/content/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "scripts/*.d.mts"]
}
```

`packages/content/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "content", environment: "node" },
});
```

В корневом `vitest.config.ts` заменить блок `coverage.include` / `exclude`:
```ts
      include: ["packages/core/src/**/*.ts", "packages/content/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/generated/**"],
```

В `pnpm-workspace.yaml` добавить (как в wishlist, чтобы pnpm не отклонил zod по возрасту релиза):
```yaml
minimumReleaseAgeExclude:
  - zod@4.6.5
```

- [ ] **Step 4: Тест (падает)**

`packages/content/src/items.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { scoreItems, TRAITS, type Answers, type Trait } from "@grani/core";
import { FRIEND_ITEMS, friendItemText, NAME_PLACEHOLDER, SELF_ITEMS } from "./items";

// Ключи IPIP-50 из https://ipip.ori.org/new_IPIP-50-item-scale.htm, вопросы 1..50.
// E — extraversion, A — agreeableness, C — conscientiousness, S — stability, O — openness.
const IPIP_KEYS = [
  "E+ A- C+ S- O+",
  "E- A+ C- S+ O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S+ O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S- O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S- O+",
  "E+ A+ C+ S- O+",
  "E- A+ C+ S- O+",
]
  .join(" ")
  .split(" ");

const LETTER_TO_TRAIT: Record<string, Trait> = {
  E: "extraversion",
  A: "agreeableness",
  C: "conscientiousness",
  S: "stability",
  O: "openness",
};

describe("SELF_ITEMS", () => {
  test("has 50 items numbered 1..50 with ids ipip-01..ipip-50", () => {
    expect(SELF_ITEMS.map((item) => item.number)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(SELF_ITEMS.map((item) => item.id)).toEqual(
      Array.from({ length: 50 }, (_, i) => `ipip-${String(i + 1).padStart(2, "0")}`),
    );
  });

  test("matches the IPIP-50 trait and key of every item", () => {
    const actual = SELF_ITEMS.map((item) => {
      const letter = Object.entries(LETTER_TO_TRAIT).find(([, trait]) => trait === item.trait)?.[0];
      return `${letter}${item.reversed ? "-" : "+"}`;
    });

    expect(actual).toEqual(IPIP_KEYS);
  });

  test("has ten items per trait", () => {
    for (const trait of TRAITS) expect(SELF_ITEMS.filter((item) => item.trait === trait)).toHaveLength(10);
  });

  test("has a Russian text and the English source for every item", () => {
    for (const item of SELF_ITEMS) {
      expect(item.text).toMatch(/[а-яё]/i);
      expect(item.source).toMatch(/^[A-Z][a-zA-Z' ]+$/);
    }
  });

  test("does not use bracketed gender endings like (а)", () => {
    for (const item of [...SELF_ITEMS, ...FRIEND_ITEMS]) expect(item.text).not.toContain("(а)");
  });
});

describe("FRIEND_ITEMS", () => {
  test("has four items per trait, two direct and two reversed", () => {
    for (const trait of TRAITS) {
      const items = FRIEND_ITEMS.filter((item) => item.trait === trait);
      expect(items).toHaveLength(4);
      expect(items.filter((item) => item.reversed)).toHaveLength(2);
    }
  });

  test("reuses self item ids with the same trait and key", () => {
    for (const friendItem of FRIEND_ITEMS) {
      const selfItem = SELF_ITEMS.find((item) => item.id === friendItem.id);
      expect(selfItem, friendItem.id).toBeDefined();
      expect(friendItem.trait).toBe(selfItem?.trait);
      expect(friendItem.reversed).toBe(selfItem?.reversed);
    }
    expect(new Set(FRIEND_ITEMS.map((item) => item.id)).size).toBe(20);
  });

  test("puts the name placeholder into every friend text exactly once", () => {
    for (const item of FRIEND_ITEMS) expect(item.text.split(NAME_PLACEHOLDER)).toHaveLength(2);
  });

  test("lets owner answers be scored on the friend subset", () => {
    const ownerAnswers: Answers = Object.fromEntries(SELF_ITEMS.map((item) => [item.id, 5]));

    const subset = scoreItems(FRIEND_ITEMS, ownerAnswers);

    for (const trait of TRAITS) expect(subset[trait]).toBe(50);
  });
});

describe("friendItemText", () => {
  test("substitutes the name", () => {
    const item = FRIEND_ITEMS.find((candidate) => candidate.id === "ipip-21");

    expect(item && friendItemText(item, "Аня")).toBe("Аня легко начинает разговор.");
  });
});
```

Пояснение к последнему тесту: на каждой черте у друзей 2 прямых и 2 обратных вопроса, поэтому ответ «5» на всё даёт `(5 + 5 + 1 + 1 − 4) / 16 × 100 = 50`.

- [ ] **Step 5: Установка и запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install
pnpm vitest run packages/content/src/items.test.ts
```
Expected: FAIL — `Failed to resolve import "./items"`.

- [ ] **Step 6: Реализация**

`packages/content/src/items.ts`:
```ts
import type { ItemKey, Trait } from "@grani/core";

export const NAME_PLACEHOLDER = "{name}";

export type SelfItem = ItemKey & { readonly number: number; readonly text: string; readonly source: string };

export type FriendItem = ItemKey & { readonly text: string };

function selfItem(number: number, trait: Trait, reversed: boolean, source: string, text: string): SelfItem {
  return { id: `ipip-${String(number).padStart(2, "0")}`, number, trait, reversed, source, text };
}

const E = "extraversion";
const A = "agreeableness";
const C = "conscientiousness";
const S = "stability";
const O = "openness";

export const SELF_ITEMS: readonly SelfItem[] = [
  selfItem(1, E, false, "Am the life of the party", "Я душа компании."),
  selfItem(2, A, true, "Feel little concern for others", "Меня мало волнуют другие люди."),
  selfItem(3, C, false, "Am always prepared", "Я всегда заранее готовлюсь."),
  selfItem(4, S, true, "Get stressed out easily", "Я легко впадаю в стресс."),
  selfItem(5, O, false, "Have a rich vocabulary", "У меня богатый словарный запас."),
  selfItem(6, E, true, "Don't talk a lot", "Я говорю немного."),
  selfItem(7, A, false, "Am interested in people", "Мне интересны люди."),
  selfItem(8, C, true, "Leave my belongings around", "Я оставляю свои вещи где попало."),
  selfItem(9, S, false, "Am relaxed most of the time", "Большую часть времени мне спокойно."),
  selfItem(10, O, true, "Have difficulty understanding abstract ideas", "Мне трудно понимать абстрактные идеи."),
  selfItem(11, E, false, "Feel comfortable around people", "Мне комфортно среди людей."),
  selfItem(12, A, true, "Insult people", "Я говорю людям обидные вещи."),
  selfItem(13, C, false, "Pay attention to details", "Я обращаю внимание на детали."),
  selfItem(14, S, true, "Worry about things", "Я много тревожусь по разным поводам."),
  selfItem(15, O, false, "Have a vivid imagination", "У меня живое воображение."),
  selfItem(16, E, true, "Keep in the background", "Я держусь в тени."),
  selfItem(17, A, false, "Sympathize with others' feelings", "Я сопереживаю другим людям."),
  selfItem(18, C, true, "Make a mess of things", "У меня часто всё идёт кувырком."),
  selfItem(19, S, false, "Seldom feel blue", "Мне редко бывает грустно."),
  selfItem(20, O, true, "Am not interested in abstract ideas", "Абстрактные идеи мне неинтересны."),
  selfItem(21, E, false, "Start conversations", "Я легко начинаю разговор."),
  selfItem(22, A, true, "Am not interested in other people's problems", "Чужие проблемы меня не интересуют."),
  selfItem(23, C, false, "Get chores done right away", "Я делаю дела сразу, не откладывая."),
  selfItem(24, S, true, "Am easily disturbed", "Меня легко выбить из колеи."),
  selfItem(25, O, false, "Have excellent ideas", "Мне приходят в голову отличные идеи."),
  selfItem(26, E, true, "Have little to say", "Мне редко есть что сказать."),
  selfItem(27, A, false, "Have a soft heart", "У меня мягкое сердце."),
  selfItem(28, C, true, "Often forget to put things back in their proper place", "Я часто забываю класть вещи на место."),
  selfItem(29, S, true, "Get upset easily", "Я легко расстраиваюсь."),
  selfItem(30, O, true, "Do not have a good imagination", "Воображение — не моя сильная сторона."),
  selfItem(31, E, false, "Talk to a lot of different people at parties", "На вечеринках я общаюсь со множеством разных людей."),
  selfItem(32, A, true, "Am not really interested in others", "Другие люди мне не особенно интересны."),
  selfItem(33, C, false, "Like order", "Я люблю порядок."),
  selfItem(34, S, true, "Change my mood a lot", "Моё настроение часто меняется."),
  selfItem(35, O, false, "Am quick to understand things", "Я быстро схватываю новое."),
  selfItem(36, E, true, "Don't like to draw attention to myself", "Я не люблю привлекать к себе внимание."),
  selfItem(37, A, false, "Take time out for others", "Я нахожу время для других."),
  selfItem(38, C, true, "Shirk my duties", "Я увиливаю от своих обязанностей."),
  selfItem(39, S, true, "Have frequent mood swings", "У меня бывают резкие перепады настроения."),
  selfItem(40, O, false, "Use difficult words", "Я использую сложные слова."),
  selfItem(41, E, false, "Don't mind being the center of attention", "Я не против быть в центре внимания."),
  selfItem(42, A, false, "Feel others' emotions", "Я чувствую эмоции других людей."),
  selfItem(43, C, false, "Follow a schedule", "Я следую распорядку."),
  selfItem(44, S, true, "Get irritated easily", "Я легко раздражаюсь."),
  selfItem(45, O, false, "Spend time reflecting on things", "Я часто размышляю о разных вещах."),
  selfItem(46, E, true, "Am quiet around strangers", "С незнакомыми людьми я больше молчу."),
  selfItem(47, A, false, "Make people feel at ease", "Рядом со мной людям спокойно и легко."),
  selfItem(48, C, false, "Am exacting in my work", "В работе я требую от себя точности."),
  selfItem(49, S, true, "Often feel blue", "Мне часто бывает грустно."),
  selfItem(50, O, false, "Am full of ideas", "У меня всегда много идей."),
];

const FRIEND_TEXTS: Readonly<Record<string, string>> = {
  "ipip-01": "{name} — душа компании.",
  "ipip-21": "{name} легко начинает разговор.",
  "ipip-16": "{name} держится в тени.",
  "ipip-46": "С незнакомыми людьми {name} больше молчит.",
  "ipip-17": "{name} сопереживает другим людям.",
  "ipip-47": "{name} умеет сделать так, что людям рядом спокойно и легко.",
  "ipip-02": "{name} мало интересуется чувствами других.",
  "ipip-12": "{name} говорит людям обидные вещи.",
  "ipip-03": "{name} всегда заранее готовится.",
  "ipip-23": "{name} делает дела сразу, не откладывая.",
  "ipip-08": "{name} оставляет вещи где попало.",
  "ipip-38": "{name} увиливает от своих обязанностей.",
  "ipip-09": "{name} большую часть времени сохраняет спокойствие.",
  "ipip-19": "{name} редко грустит.",
  "ipip-04": "{name} легко впадает в стресс.",
  "ipip-44": "{name} легко раздражается.",
  "ipip-15": "{name} умеет ярко фантазировать.",
  "ipip-50": "{name} постоянно придумывает новые идеи.",
  "ipip-20": "{name} не интересуется абстрактными идеями.",
  "ipip-30": "{name} редко фантазирует.",
};

export const FRIEND_ITEMS: readonly FriendItem[] = SELF_ITEMS.flatMap((item) => {
  const text = FRIEND_TEXTS[item.id];
  return text === undefined ? [] : [{ id: item.id, trait: item.trait, reversed: item.reversed, text }];
});

export function friendItemText(item: FriendItem, name: string): string {
  return item.text.replace(NAME_PLACEHOLDER, name);
}
```

`packages/content/src/index.ts`:
```ts
export * from "./items";
```

- [ ] **Step 7: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные (план 1 + `items.test.ts`), typecheck без ошибок.

- [ ] **Step 8: Вычитка формулировок пользователем**

Показать пользователю таблицу: номер, английский источник, русский текст о себе, текст для друзей (если есть). Попросить проверить естественность и точность смысла. Правки внести в `items.ts`, тесты прогнать снова.

- [ ] **Step 9: Коммит**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml vitest.config.ts packages/content
git commit -m "feat(content): IPIP-50 items in Russian and friend questionnaire"
```
