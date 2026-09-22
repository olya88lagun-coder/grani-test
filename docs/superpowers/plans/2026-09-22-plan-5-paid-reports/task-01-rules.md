# Task 1: Правила продуктов и разборов, очередь `generate`, общие подписи и сравнение с друзьями

**Files:**
- Create: `packages/core/src/reports.ts`, `packages/core/src/reports.test.ts`
- Modify: `packages/core/src/queues.ts`, `packages/core/src/queues.test.ts`, `packages/core/src/index.ts`
- Create: `packages/content/src/labels.ts`, `packages/content/src/labels.test.ts`, `packages/content/src/friends.ts`, `packages/content/src/friends.test.ts`
- Modify: `packages/content/src/index.ts`, `apps/web/src/lib/result-view.ts`, `apps/web/src/server/friends-service.ts`

**Interfaces:**
- Consumes: `PRODUCT_PRICES`, `Product`, `CHAPTER_PRODUCTS` (план 1, `pricing.ts`); `MIN_FRIENDS`, `compareWithFriends`, `scoreItems`, `FriendComparison`, `Answers` (`@grani/core`); `FRIEND_ITEMS`, `TraitSection` (`@grani/content`).
- Produces:
  ```ts
  // packages/core/src/reports.ts
  const REPORT_KINDS: readonly ["full", "friends", "chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships", "pair"];
  type ReportKind = (typeof REPORT_KINDS)[number];
  type ChapterKind = (typeof CHAPTER_PRODUCTS)[number];
  const CHAPTER_KINDS: readonly ChapterKind[];
  type ProductTarget = "result" | "pair";
  function isReportKind(value: unknown): value is ReportKind;
  function productTarget(product: Product): ProductTarget;
  function reportKindsFor(product: Product): readonly ReportKind[];
  function unlockedKinds(owned: readonly Product[]): ReadonlySet<ReportKind>;
  function canBuy(product: Product, owned: readonly Product[]): boolean;
  function friendsReportDue(owned: readonly Product[], friendsCount: number): boolean;

  // packages/core/src/queues.ts
  const QUEUES: { notify: "notify"; generate: "generate" };
  type GenerateJob = { kind: Exclude<ReportKind, "pair">; resultId: string } | { kind: "pair"; pairId: string };
  type NotifyJob = … | { kind: "report_ready"; reportId: string };
  const GENERATE_JOB_OPTIONS: { retryLimit: 2; retryDelay: 30; retryBackoff: true; expireInSeconds: 600 };
  function generateJobKey(job: GenerateJob): string; // "generate:<id>:<kind>"

  // packages/content/src/labels.ts
  const TRAIT_LABELS: Readonly<Record<Trait, string>>;
  const CHAPTER_TITLES: Readonly<Record<ChapterKind, string>>;
  const CHAPTER_SECTIONS: Readonly<Record<ChapterKind, TraitSection>>;

  // packages/content/src/friends.ts
  function compareFriendAnswers(ownerAnswers: Answers, friendAnswers: readonly Answers[]): FriendComparison | null;
  ```

Продукты и виды разборов называются одинаково, кроме двух: `chapters_all` открывает все четыре главы, а `friends` — не продукт: этот раздел открывается полным разбором вместе с тремя ответами друзей. Правила покупки — из раздела 4.3 спецификации и Global Constraints плана.

Подписи черт и сравнение с друзьями нужны теперь и сайту, и воркеру (вход модели, запасная сборка), поэтому переезжают из `apps/web` в `@grani/content`; сайт импортирует их оттуда.

- [ ] **Step 0: Ветка**

```bash
cd /c/dev/grani-test
git checkout master && git pull
git checkout -b feat/paid-reports
```

- [ ] **Step 1: Тесты правил (падают)**

`packages/core/src/reports.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { CHAPTER_KINDS, canBuy, friendsReportDue, isReportKind, productTarget, reportKindsFor, unlockedKinds } from "./reports";

describe("reportKindsFor", () => {
  test("a product opens the report of the same name, all chapters open four", () => {
    expect(reportKindsFor("full")).toEqual(["full"]);
    expect(reportKindsFor("chapter_money")).toEqual(["chapter_money"]);
    expect(reportKindsFor("chapters_all")).toEqual(CHAPTER_KINDS);
    expect(reportKindsFor("pair")).toEqual(["pair"]);
  });

  test("only the pair report belongs to a pair", () => {
    expect(productTarget("pair")).toBe("pair");
    expect(productTarget("full")).toBe("result");
    expect(productTarget("chapters_all")).toBe("result");
  });

  test("collects everything the purchases opened", () => {
    expect([...unlockedKinds(["full", "chapters_all"])].sort()).toEqual(["chapter_conflict", "chapter_money", "chapter_relationships", "chapter_stress", "full"]);
  });
});

describe("canBuy", () => {
  test("the full report is bought once", () => {
    expect(canBuy("full", [])).toBe(true);
    expect(canBuy("full", ["full"])).toBe(false);
  });

  test("chapters need the full report", () => {
    expect(canBuy("chapter_money", [])).toBe(false);
    expect(canBuy("chapters_all", [])).toBe(false);
    expect(canBuy("chapter_money", ["full"])).toBe(true);
    expect(canBuy("chapters_all", ["full"])).toBe(true);
  });

  test("a chapter is not sold twice and the bundle only while no chapter is bought", () => {
    expect(canBuy("chapter_money", ["full", "chapter_money"])).toBe(false);
    expect(canBuy("chapter_stress", ["full", "chapter_money"])).toBe(true);
    expect(canBuy("chapters_all", ["full", "chapter_money"])).toBe(false);
    expect(canBuy("chapter_stress", ["full", "chapters_all"])).toBe(false);
  });

  test("the pair report is bought once per pair", () => {
    expect(canBuy("pair", [])).toBe(true);
    expect(canBuy("pair", ["pair"])).toBe(false);
  });
});

describe("friendsReportDue", () => {
  test("needs the full report and three friends", () => {
    expect(friendsReportDue(["full"], 3)).toBe(true);
    expect(friendsReportDue(["full"], 2)).toBe(false);
    expect(friendsReportDue([], 5)).toBe(false);
  });
});

test("recognizes report kinds", () => {
  expect(isReportKind("friends")).toBe(true);
  expect(isReportKind("chapters_all")).toBe(false);
});
```

В `packages/core/src/queues.test.ts` дописать:
```ts
test("generation jobs are keyed by target and kind", () => {
  expect(QUEUES.generate).toBe("generate");
  expect(generateJobKey({ kind: "full", resultId: "r1" })).toBe("generate:r1:full");
  expect(generateJobKey({ kind: "pair", pairId: "p1" })).toBe("generate:p1:pair");
  expect(notifyJobKey({ kind: "report_ready", reportId: "rep1" })).toBe("report_ready:rep1");
});
```
и `generateJobKey` в импорт.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/core/src/reports.test.ts packages/core/src/queues.test.ts
```
Expected: FAIL — нет `./reports` и `generateJobKey`.

- [ ] **Step 2: Реализация правил**

`packages/core/src/reports.ts`:
```ts
import { MIN_FRIENDS } from "./friends";
import { CHAPTER_PRODUCTS, type Product } from "./pricing";

export const REPORT_KINDS = ["full", "friends", "chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships", "pair"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export type ChapterKind = (typeof CHAPTER_PRODUCTS)[number];
export const CHAPTER_KINDS: readonly ChapterKind[] = CHAPTER_PRODUCTS;
export type ProductTarget = "result" | "pair";

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && (REPORT_KINDS as readonly string[]).includes(value);
}

export function productTarget(product: Product): ProductTarget {
  return product === "pair" ? "pair" : "result";
}

// Имена продуктов и разборов совпадают, кроме набора из четырёх глав
export function reportKindsFor(product: Product): readonly ReportKind[] {
  return product === "chapters_all" ? CHAPTER_KINDS : [product];
}

export function unlockedKinds(owned: readonly Product[]): ReadonlySet<ReportKind> {
  return new Set(owned.flatMap(reportKindsFor));
}

export function canBuy(product: Product, owned: readonly Product[]): boolean {
  const unlocked = unlockedKinds(owned);
  if (product === "full" || product === "pair") return !unlocked.has(product);
  if (!unlocked.has("full")) return false;
  // Набор дешевле четырёх глав, поэтому продаётся только тому, у кого ещё нет ни одной
  if (product === "chapters_all") return CHAPTER_KINDS.every((kind) => !unlocked.has(kind));
  return !unlocked.has(product);
}

export function friendsReportDue(owned: readonly Product[], friendsCount: number): boolean {
  return unlockedKinds(owned).has("full") && friendsCount >= MIN_FRIENDS;
}
```

`packages/core/src/queues.ts` целиком:
```ts
import type { ReportKind } from "./reports";

export const QUEUES = { notify: "notify", generate: "generate" } as const;

export type NotifyJob =
  | { kind: "friend_answered"; inviteId: string; friendsCount: number }
  | { kind: "pair_created"; pairId: string }
  | { kind: "report_ready"; reportId: string };

export type GenerateJob = { kind: Exclude<ReportKind, "pair">; resultId: string } | { kind: "pair"; pairId: string };

// Уведомление — не критичное действие: три попытки с растущей паузой, дальше задача остаётся failed для разбора в логах
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 120 } as const;
// Внутри задачи уже три попытки модели по 60 с и сборка из блоков; повтор pg-boss нужен только при сбое базы
export const GENERATE_JOB_OPTIONS = { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 600 } as const;

export function notifyJobKey(job: NotifyJob): string {
  if (job.kind === "friend_answered") return `friend_answered:${job.inviteId}:${job.friendsCount}`;
  if (job.kind === "pair_created") return `pair_created:${job.pairId}`;
  return `report_ready:${job.reportId}`;
}

export function generateJobKey(job: GenerateJob): string {
  return `generate:${job.kind === "pair" ? job.pairId : job.resultId}:${job.kind}`;
}
```

В `packages/core/src/index.ts` добавить `export * from "./reports";`.

```bash
pnpm vitest run packages/core
```
Expected: PASS.

- [ ] **Step 3: Тесты подписей и сравнения (падают)**

`packages/content/src/labels.test.ts`:
```ts
import { CHAPTER_KINDS, TRAITS } from "@grani/core";
import { expect, test } from "vitest";
import { TRAIT_SECTIONS } from "./keys";
import { CHAPTER_SECTIONS, CHAPTER_TITLES, TRAIT_LABELS } from "./labels";

test("every trait and chapter has a label, chapters map to library sections", () => {
  expect(TRAITS.map((trait) => TRAIT_LABELS[trait])).toEqual(["Открытость опыту", "Добросовестность", "Экстраверсия", "Доброжелательность", "Эмоциональная устойчивость"]);
  expect(CHAPTER_KINDS.map((kind) => CHAPTER_TITLES[kind])).toEqual(["Деньги", "Конфликты", "Стресс", "Отношения"]);
  for (const kind of CHAPTER_KINDS) expect(TRAIT_SECTIONS).toContain(CHAPTER_SECTIONS[kind]);
});
```

`packages/content/src/friends.test.ts`:
```ts
import type { Answer, Answers } from "@grani/core";
import { expect, test } from "vitest";
import { compareFriendAnswers } from "./friends";
import { FRIEND_ITEMS } from "./items";

const all = (value: Answer): Answers => Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, value]));

test("compares the owner's own answers on the friend items with the friends' average", () => {
  expect(compareFriendAnswers(all(3), [all(3), all(3)])).toBeNull();

  const comparison = compareFriendAnswers(all(3), [all(3), all(3), all(3)]);

  expect(comparison?.friendsCount).toBe(3);
  expect(comparison?.traits.openness).toEqual({ self: 50, friends: 50, diff: 0, notable: false });
});
```

```bash
pnpm vitest run packages/content/src/labels.test.ts packages/content/src/friends.test.ts
```
Expected: FAIL — модулей нет.

- [ ] **Step 4: Реализация и переезд**

`packages/content/src/labels.ts`:
```ts
import type { ChapterKind, Trait } from "@grani/core";
import type { TraitSection } from "./keys";

export const TRAIT_LABELS: Readonly<Record<Trait, string>> = {
  openness: "Открытость опыту",
  conscientiousness: "Добросовестность",
  extraversion: "Экстраверсия",
  agreeableness: "Доброжелательность",
  stability: "Эмоциональная устойчивость",
};

export const CHAPTER_TITLES: Readonly<Record<ChapterKind, string>> = {
  chapter_money: "Деньги",
  chapter_conflict: "Конфликты",
  chapter_stress: "Стресс",
  chapter_relationships: "Отношения",
};

// Глава собирается из блоков библиотеки того же раздела по всем пяти чертам
export const CHAPTER_SECTIONS: Readonly<Record<ChapterKind, TraitSection>> = {
  chapter_money: "money",
  chapter_conflict: "conflict",
  chapter_stress: "stress",
  chapter_relationships: "relationships",
};
```

`packages/content/src/friends.ts`:
```ts
import { compareWithFriends, scoreItems, type Answers, type FriendComparison } from "@grani/core";
import { FRIEND_ITEMS } from "./items";

// Владелец и друзья считаются по одним и тем же 20 вопросам: так сравнение честное
export function compareFriendAnswers(ownerAnswers: Answers, friendAnswers: readonly Answers[]): FriendComparison | null {
  return compareWithFriends(
    scoreItems(FRIEND_ITEMS, ownerAnswers),
    friendAnswers.map((answers) => scoreItems(FRIEND_ITEMS, answers)),
  );
}
```

В `packages/content/src/index.ts` добавить `export * from "./labels";` и `export * from "./friends";`.

В `apps/web/src/lib/result-view.ts` удалить локальный `TRAIT_LABELS` и добавить `TRAIT_LABELS` в импорт из `@grani/content` плюс строку реэкспорта `export { TRAIT_LABELS } from "@grani/content";` — остальные модули сайта и тест `result-view.test.ts` продолжают импортировать из `./result-view`.

В `apps/web/src/server/friends-service.ts` в `getFriendsSummary` заменить две строки подсчёта (`selfSubset`, `friendScores`) и вызов `compareWithFriends` на
```ts
  return { ...base, comparison: compareFriendAnswers(context.ownerAnswers, friendAnswers) };
```
с импортом `compareFriendAnswers` из `@grani/content`; из импорта `@grani/core` убрать ставшие ненужными `compareWithFriends` и `scoreItems`.

В `apps/worker/src/notify.ts` в начало `runNotify` добавить (новый вид уведомления иначе не проходит typecheck; настоящую отправку добавит Task 7):
```ts
  // report_ready обрабатывается с Task 7 плана 5; до неё такие задачи никто не ставит
  if (job.kind === "report_ready") return;
```

- [ ] **Step 5: Проверка и коммит**

```bash
pnpm test && pnpm typecheck
```
Expected: всё зелёное (тесты друзей сайта не менялись и проходят).

```bash
git add packages/core packages/content/src apps/web/src/lib/result-view.ts apps/web/src/server/friends-service.ts apps/worker/src/notify.ts
git commit -m "feat(core): product rules for reports and the generate queue, shared trait labels and friend comparison"
```
