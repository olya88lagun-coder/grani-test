# Task 6: Прайс, итоговая проверка и мерж

**Files:**
- Create: `packages/core/src/pricing.ts`
- Test: `packages/core/src/pricing.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  const PRODUCT_PRICES: {
    readonly full: 29900;
    readonly chapter_money: 9900;
    readonly chapter_conflict: 9900;
    readonly chapter_stress: 9900;
    readonly chapter_relationships: 9900;
    readonly chapters_all: 24900;
    readonly pair: 39900;
  }; // копейки
  type Product = keyof typeof PRODUCT_PRICES;
  const CHAPTER_PRODUCTS: readonly ["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"];
  function isProduct(value: unknown): value is Product;
  function formatRub(kopecks: number): string; // "299 ₽", разделители — неразрывные пробелы
  ```

Прайс — единственный источник сумм для платежей (план 5): сервер берёт сумму отсюда, а не от клиента. Идентификаторы продуктов совпадают со значениями `purchases.product` из раздела 5.2 спецификации. Все цены — целые рубли, поэтому `formatRub` принимает только суммы, кратные 100 копейкам.

- [ ] **Step 1: Тест (падает)**

`packages/core/src/pricing.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { CHAPTER_PRODUCTS, formatRub, isProduct, PRODUCT_PRICES } from "./pricing";

const NBSP = " ";

describe("PRODUCT_PRICES", () => {
  test("matches the prices agreed in the spec", () => {
    expect(PRODUCT_PRICES).toEqual({
      full: 29900,
      chapter_money: 9900,
      chapter_conflict: 9900,
      chapter_stress: 9900,
      chapter_relationships: 9900,
      chapters_all: 24900,
      pair: 39900,
    });
  });

  test("makes all chapters cheaper than buying them one by one", () => {
    const separately = CHAPTER_PRODUCTS.reduce((total, product) => total + PRODUCT_PRICES[product], 0);

    expect(PRODUCT_PRICES.chapters_all).toBeLessThan(separately);
  });
});

describe("isProduct", () => {
  test.each(["full", "pair", "chapters_all", "chapter_stress"])("accepts %s", (value) => {
    expect(isProduct(value)).toBe(true);
  });

  test.each(["", "FULL", "chapter", "toString", 42, null, undefined])("rejects %j", (value) => {
    expect(isProduct(value)).toBe(false);
  });
});

describe("formatRub", () => {
  test("formats whole rubles with a non-breaking space before the sign", () => {
    expect(formatRub(29900)).toBe(`299${NBSP}₽`);
    expect(formatRub(39900)).toBe(`399${NBSP}₽`);
  });

  test("groups thousands with non-breaking spaces", () => {
    expect(formatRub(15000000)).toBe(`150${NBSP}000${NBSP}₽`);
  });

  test.each([29950, -100, 1.5])("rejects %d kopecks", (kopecks) => {
    expect(() => formatRub(kopecks)).toThrow();
  });
});
```

- [ ] **Step 2: Запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/pricing.test.ts
```
Expected: FAIL — `Failed to resolve import "./pricing"`.

- [ ] **Step 3: Реализация**

`packages/core/src/pricing.ts`:
```ts
export const PRODUCT_PRICES = {
  full: 29900,
  chapter_money: 9900,
  chapter_conflict: 9900,
  chapter_stress: 9900,
  chapter_relationships: 9900,
  chapters_all: 24900,
  pair: 39900,
} as const;

export type Product = keyof typeof PRODUCT_PRICES;

export const CHAPTER_PRODUCTS = ["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"] as const;

const KOPECKS_PER_RUBLE = 100;
const NBSP = " ";

export function isProduct(value: unknown): value is Product {
  return typeof value === "string" && Object.hasOwn(PRODUCT_PRICES, value);
}

export function formatRub(kopecks: number): string {
  if (!Number.isInteger(kopecks) || kopecks < 0 || kopecks % KOPECKS_PER_RUBLE !== 0) {
    throw new Error(`Expected a non-negative whole-ruble amount in kopecks, got ${kopecks}`);
  }
  const rubles = kopecks / KOPECKS_PER_RUBLE;
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${grouped}${NBSP}₽`;
}
```

Группировка сделана регулярным выражением, а не `toLocaleString`, чтобы результат не зависел от сборки ICU в Node и в браузере.

`packages/core/src/index.ts`:
```ts
export * from "./traits";
export * from "./scoring";
export * from "./types";
export * from "./friends";
export * from "./compatibility";
export * from "./pricing";
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add packages/core/src/pricing.ts packages/core/src/pricing.test.ts packages/core/src/index.ts
git commit -m "feat(core): product prices and ruble formatting"
```

- [ ] **Step 6: Итоговая проверка плана**

```bash
pnpm test && pnpm typecheck && pnpm test:coverage
```
Expected:
- все тесты зелёные (6 файлов тестов);
- typecheck без ошибок;
- покрытие `packages/core/src` ≥ 80% по строкам, ветвям, функциям и инструкциям — Vitest завершается с кодом 0.

Если порог не пройден, найти непокрытые строки в отчёте Vitest и добавить тесты поведения, а не снижать порог.

- [ ] **Step 7: Сверка со спецификацией**

Пройти по Global Constraints файла `00-overview.md` и убедиться, что каждое число из спецификации (пороги 50 / 45–55 / 15 / 25, минимум 3 друга, уровни совместимости, цены) проверено хотя бы одним тестом. Отметить в `00-overview.md` строкой под заголовком: `> **Статус: выполнен YYYY-MM-DD.**`

```bash
git add docs/superpowers/plans/2026-09-16-plan-1-core/00-overview.md
git commit -m "docs: mark plan 1 (core) as done"
```

- [ ] **Step 8: Мерж — только после согласия пользователя**

Показать пользователю итог: число тестов, покрытие, список коммитов (`git log --oneline master..feat/core`). После явного «да»:

```bash
git checkout master
git merge --no-ff feat/core -m "merge: plan 1 core"
git branch -d feat/core
```
