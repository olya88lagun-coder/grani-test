# «Вдвоём»: серверный слой пространства и оплаты — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать «Вдвоём» рабочий серверный фундамент: два аккаунта образуют общее пространство и оплачивают общий доступ на 30 суток; деньги принимаются без дублей и потерь.

**Architecture:** Новые таблицы `together_*` не зависят от `results` и `pairs`. Деньги и чеки остаются в `purchases` (новый продукт `together_30d`, колонка `space_id`); оплаченные интервалы лежат в `together_access_periods` с уникальным `purchase_id`. Математика доступа — чистые функции в `packages/core`; транзакции с блокировками — в `packages/db`; сервисы и API — в `apps/web`.

**Tech Stack:** TypeScript (strict, ESM), Next.js 16.3.5 route handlers, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10, PostgreSQL (в тестах PGlite), Vitest 5, Playwright (локальный e2e), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-05-together-backend-design.md` (ADR: `docs/together/adr/ADR-001-together-space.md`)

## Global Constraints

- Ветка `feat/together-backend` (от `feat/together-prototype`). Без `push`, PR, слияния и деплоя без отдельной команды владельца.
- Цена и срок — только `TOGETHER_PRICE_KOPECKS = 59_900` и `TOGETHER_PERIOD_DAYS = 30` в `packages/core`; срок приглашения `TOGETHER_INVITE_TTL_DAYS = 7` там же.
- Все времена UTC; даты в БД `timestamp with time zone`.
- Токен приглашения хранится только хешем SHA-256; сырой токен возвращается один раз.
- Права определяются сессией и членством, а не токеном; чужие, просроченные, отозванные и использованные ссылки получают один и тот же нейтральный ответ.
- Статус платежа меняется только в `syncPayment` по ответу API шлюза; return URL ничего не доказывает.
- Старые продукты (`Product` в `packages/core`) и старые покупки отчётов не меняют поведение; `together_30d` не добавляется в `Product` и `PRODUCT_PRICES`, поэтому `/api/purchases` его отвергает.
- Порядок блокировок во всех операциях один: пользователь → пространство → приглашение.
- Код в стиле репозитория: комментарии на русском, имена тестов на английском, без `console.log`, функции короче 50 строк, файлы короче 800 строк, неизменяемые данные.
- `apps/web/AGENTS.md`: Next.js здесь нестандартный; формы route handlers сверены с `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (`params` — `Promise`, `export async function GET/POST(request: NextRequest, { params })`).
- Покрытие не ниже 80% (`pnpm test:coverage`), `pnpm typecheck` и все прежние тесты зелёные. CI (`ci.yml`) гоняет только typecheck и coverage; e2e — локально.

## Review Focus

1. Двойной клик «создать»/«запросить» и повтор запроса тем же человеком: ровно одно пространство и один запрос (тесты в Task 3).
2. Третий человек и инициатор по ссылке: нейтральный отказ, ни имён, ни членства (Task 3, Task 8 e2e).
3. Платёж прошёл, а пространство уже закрыто: доступ не выдаётся, платёж виден в списке владельца (Task 4, Task 6).
4. Удаление аккаунта, когда человек состоит в пространстве или ждёт подтверждения: пространство закрывается, партнёр свободен, запись об оплате остаётся (Task 3).
5. Границы времени: ровно 30 суток, `ends_at` исключительно, остаток ровно 30 суток разрешает покупку, на 1 мс больше — блокирует (Task 1).
6. Попытка купить `together_30d` через старый `/api/purchases` и открыть такую покупку через старый `getPurchaseView` (Task 6).
7. Падение между переходом в `succeeded` и выдачей периода: следующий `syncPayment` или опрос статуса выдаёт период один раз (Task 6).
8. Потолок «не более одного периода вперёд»: сразу после первой оплаты второй платёж допустим (потолок 60 суток), третий — нет (Task 6).

---

## File Structure

| Файл | Ответственность |
|---|---|
| `packages/core/src/together-access.ts` (+`.test.ts`) | Константы, типы продукта, чистая математика интервалов и этапов |
| `packages/core/src/index.ts` | Экспорт нового модуля |
| `packages/db/src/schema.ts` | Новые таблицы/enum, `purchases.space_id`, расширенный check |
| `packages/db/drizzle/0005_together_spaces.sql` (+`meta`) | Сгенерированная миграция |
| `packages/db/src/together-schema.test.ts` | Тесты инвариантов самой БД |
| `packages/db/src/together.ts` (+`.test.ts`) | Пространство, участники, приглашения, выход |
| `packages/db/src/together-billing.ts` (+`.test.ts`) | Журнал периодов, резерв покупки, выдача, списки владельца |
| `packages/db/src/purchases.ts` | Тип `PurchaseProduct`, цель-пространство, `toPurchaseRecord` |
| `packages/db/src/delete-user.ts` | Закрытие пространства при удалении аккаунта |
| `packages/db/src/testing.ts` | `seedUser`, `seedTogetherSpace` |
| `apps/web/src/server/together-service.ts` (+`.test.ts`) | Сценарии пространства, виды ответов |
| `apps/web/src/server/together-payments.ts` (+`.test.ts`) | Старт оплаты, выдача доступа, статус покупки |
| `apps/web/src/server/payments-service.ts` | Сужение типов и диспетчеризация по продукту |
| `apps/web/src/server/together-route.ts` (+`.test.ts`) | Общая проверка origin/лимита/сессии для маршрутов |
| `apps/web/src/server/rate-limit.ts`, `owner.ts` | Лимитер, `isOwnerUser` |
| `apps/web/src/app/api/together/**`, `api/admin/together/route.ts` | Тонкие HTTP-маршруты |
| `apps/web/src/app/api/dev/pay/[id]/route.ts` | Возврат с фейковой оплаты для `together_30d` |
| `e2e/together.spec.ts` | Сквозной API-сценарий двух аккаунтов |
| `docs/…` | Спека, ADR, handoff |

---

### Task 1: Математика доступа в `packages/core`

**Files:**
- Create: `packages/core/src/together-access.ts`
- Create: `packages/core/src/together-access.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces (используют все следующие задачи):
  - `TOGETHER_PRODUCT = "together_30d"`, `type TogetherProduct`, `type PurchaseProduct = Product | TogetherProduct`, `isTogetherProduct(value: unknown): value is TogetherProduct`
  - `TOGETHER_PERIOD_DAYS`, `TOGETHER_PERIOD_MS`, `TOGETHER_PRICE_KOPECKS`, `TOGETHER_MAX_STAGE`, `TOGETHER_INVITE_TTL_DAYS`, `TOGETHER_INVITE_TTL_MS`
  - `type AccessPeriod = { startsAt: Date; endsAt: Date }`, `type AccessState = { active: boolean; accessUntil: Date | null; remainingMs: number }`
  - `nextPeriod(existing: readonly AccessPeriod[], paidAt: Date): AccessPeriod`
  - `providedPaidSeconds(periods: readonly AccessPeriod[], now: Date, closedAt?: Date | null): number`
  - `stageOf(seconds: number): number`
  - `accessState(periods: readonly AccessPeriod[], now: Date, closedAt?: Date | null): AccessState`
  - `canRenew(periods: readonly AccessPeriod[], now: Date, closedAt?: Date | null): boolean`
  - `unusedPaidMs(periods: readonly AccessPeriod[], closedAt: Date): number`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/together-access.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  accessState,
  canRenew,
  isTogetherProduct,
  nextPeriod,
  providedPaidSeconds,
  stageOf,
  TOGETHER_PERIOD_MS,
  unusedPaidMs,
  type AccessPeriod,
} from "./together-access";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DAY_SECONDS = 86_400;
const period = (start: string, end: string): AccessPeriod => ({ startsAt: at(start), endsAt: at(end) });
const OCTOBER = period("2026-10-01", "2026-10-31");

describe("nextPeriod", () => {
  test("starts at the payment time when nothing was paid before", () => {
    expect(nextPeriod([], at("2026-10-01"))).toEqual(OCTOBER);
  });

  test("an early payment starts when the current access ends", () => {
    expect(nextPeriod([OCTOBER], at("2026-10-20"))).toEqual(period("2026-10-31", "2026-11-30"));
  });

  test("a late payment starts at the payment time and leaves the gap unpaid", () => {
    expect(nextPeriod([OCTOBER], at("2026-11-10"))).toEqual(period("2026-11-10", "2026-12-10"));
  });
});

describe("providedPaidSeconds", () => {
  test("counts only the part of a period that has already passed", () => {
    expect(providedPaidSeconds([OCTOBER], at("2026-10-11"))).toBe(10 * DAY_SECONDS);
    expect(providedPaidSeconds([OCTOBER], at("2026-12-01"))).toBe(30 * DAY_SECONDS);
    expect(providedPaidSeconds([OCTOBER], at("2026-09-01"))).toBe(0);
  });

  test("does not count a gap between periods", () => {
    const periods = [OCTOBER, period("2026-11-10", "2026-12-10")];

    expect(providedPaidSeconds(periods, at("2026-12-31"))).toBe(60 * DAY_SECONDS);
  });

  test("does not count overlapping time twice", () => {
    const periods = [OCTOBER, period("2026-10-20", "2026-11-19")];

    expect(providedPaidSeconds(periods, at("2026-11-30"))).toBe(49 * DAY_SECONDS);
  });

  test("a closed space stops providing time at the closing moment", () => {
    expect(providedPaidSeconds([OCTOBER], at("2026-11-30"), at("2026-10-11"))).toBe(10 * DAY_SECONDS);
  });
});

describe("stageOf", () => {
  test("rounds down to whole 30-day periods and stops at twelve", () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(30 * DAY_SECONDS - 1)).toBe(0);
    expect(stageOf(30 * DAY_SECONDS)).toBe(1);
    expect(stageOf(90 * DAY_SECONDS)).toBe(3);
    expect(stageOf(10_000 * DAY_SECONDS)).toBe(12);
  });
});

describe("accessState", () => {
  test("is active inside a period and inactive exactly at its end", () => {
    expect(accessState([OCTOBER], at("2026-10-15")).active).toBe(true);
    expect(accessState([OCTOBER], at("2026-10-31")).active).toBe(false);
  });

  test("reports the end of paid access and the time left", () => {
    expect(accessState([OCTOBER], at("2026-10-21"))).toEqual({ active: true, accessUntil: at("2026-10-31"), remainingMs: 10 * DAY_SECONDS * 1000 });
  });

  test("has no access and no end date before the first payment", () => {
    expect(accessState([], at("2026-10-01"))).toEqual({ active: false, accessUntil: null, remainingMs: 0 });
  });

  test("a closed space has no access and ends at the closing moment", () => {
    expect(accessState([OCTOBER], at("2026-10-15"), at("2026-10-11"))).toEqual({ active: false, accessUntil: at("2026-10-11"), remainingMs: 0 });
  });
});

describe("canRenew", () => {
  test("allows the first payment", () => {
    expect(canRenew([], at("2026-10-01"))).toBe(true);
  });

  test("allows renewal while 30 days or less of access remain", () => {
    expect(canRenew([OCTOBER], at("2026-10-01"))).toBe(true);
    expect(canRenew([OCTOBER], at("2026-10-25"))).toBe(true);
  });

  test("refuses when more than 30 days are already paid ahead", () => {
    expect(canRenew([OCTOBER], new Date(at("2026-10-01").getTime() - 1))).toBe(false);
    expect(canRenew([OCTOBER, period("2026-10-31", "2026-11-30")], at("2026-10-15"))).toBe(false);
    expect(TOGETHER_PERIOD_MS).toBe(30 * DAY_SECONDS * 1000);
  });

  test("refuses for a closed space", () => {
    expect(canRenew([], at("2026-10-01"), at("2026-10-01"))).toBe(false);
  });
});

describe("unusedPaidMs", () => {
  test("is the paid time left after the closing moment", () => {
    expect(unusedPaidMs([OCTOBER], at("2026-10-21"))).toBe(10 * DAY_SECONDS * 1000);
    expect(unusedPaidMs([OCTOBER], at("2026-09-01"))).toBe(30 * DAY_SECONDS * 1000);
    expect(unusedPaidMs([OCTOBER], at("2026-11-15"))).toBe(0);
  });

  test("does not count overlapping time twice", () => {
    expect(unusedPaidMs([OCTOBER, period("2026-10-20", "2026-11-19")], at("2026-10-31"))).toBe(19 * DAY_SECONDS * 1000);
  });
});

describe("isTogetherProduct", () => {
  test("recognizes only the together product", () => {
    expect(isTogetherProduct("together_30d")).toBe(true);
    expect(isTogetherProduct("full")).toBe(false);
    expect(isTogetherProduct(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/together-access.test.ts`
Expected: FAIL, `Failed to resolve import "./together-access"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/together-access.ts`:

```ts
import type { Product } from "./pricing";

export const TOGETHER_PRODUCT = "together_30d";
export type TogetherProduct = typeof TOGETHER_PRODUCT;
// Покупка в БД бывает продуктом отчётов или доступом «Вдвоём»; Product остаётся только про отчёты
export type PurchaseProduct = Product | TogetherProduct;

export const TOGETHER_PERIOD_DAYS = 30;
export const TOGETHER_PRICE_KOPECKS = 59_900;
export const TOGETHER_MAX_STAGE = 12;
export const TOGETHER_INVITE_TTL_DAYS = 7;

const DAY_MS = 86_400_000;
const SECOND_MS = 1000;
export const TOGETHER_PERIOD_MS = TOGETHER_PERIOD_DAYS * DAY_MS;
export const TOGETHER_INVITE_TTL_MS = TOGETHER_INVITE_TTL_DAYS * DAY_MS;

export type AccessPeriod = { startsAt: Date; endsAt: Date };
export type AccessState = { active: boolean; accessUntil: Date | null; remainingMs: number };

type Interval = readonly [start: number, end: number];

export function isTogetherProduct(value: unknown): value is TogetherProduct {
  return value === TOGETHER_PRODUCT;
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) merged[merged.length - 1] = [last[0], Math.max(last[1], end)];
    else merged.push([start, end]);
  }
  return merged;
}

// Закрытие пространства обрезает все периоды в момент закрытия
function effectiveIntervals(periods: readonly AccessPeriod[], closedAt: Date | null): Interval[] {
  const cap = closedAt ? closedAt.getTime() : Number.POSITIVE_INFINITY;
  return mergeIntervals(periods.map((p): Interval => [p.startsAt.getTime(), Math.min(p.endsAt.getTime(), cap)]));
}

const totalMs = (intervals: readonly Interval[]) => intervals.reduce((sum, [start, end]) => sum + (end - start), 0);

// Новый период начинается там, где кончается последний: ранний платёж добавляет срок после текущего, поздний оставляет пропуск неоплаченным
export function nextPeriod(existing: readonly AccessPeriod[], paidAt: Date): AccessPeriod {
  const lastEnd = existing.reduce((max, p) => Math.max(max, p.endsAt.getTime()), Number.NEGATIVE_INFINITY);
  const start = Math.max(paidAt.getTime(), lastEnd);
  return { startsAt: new Date(start), endsAt: new Date(start + TOGETHER_PERIOD_MS) };
}

export function providedPaidSeconds(periods: readonly AccessPeriod[], now: Date, closedAt: Date | null = null): number {
  const nowMs = now.getTime();
  const elapsed = effectiveIntervals(periods, closedAt).map(([start, end]): Interval => [start, Math.min(end, nowMs)]);
  return Math.floor(totalMs(elapsed.filter(([start, end]) => end > start)) / SECOND_MS);
}

export function stageOf(seconds: number): number {
  return Math.min(TOGETHER_MAX_STAGE, Math.floor(seconds / ((TOGETHER_PERIOD_DAYS * DAY_MS) / SECOND_MS)));
}

export function accessState(periods: readonly AccessPeriod[], now: Date, closedAt: Date | null = null): AccessState {
  const nowMs = now.getTime();
  const intervals = effectiveIntervals(periods, closedAt);
  const last = intervals.at(-1);
  return {
    active: intervals.some(([start, end]) => start <= nowMs && nowMs < end),
    accessUntil: last ? new Date(last[1]) : null,
    remainingMs: last ? Math.max(0, last[1] - nowMs) : 0,
  };
}

// Потолок — два периода (60 суток): покупать можно, пока оплаченного доступа осталось не больше 30 суток.
// Сразу после первой оплаты второй платёж допустим, третий нет. Нестрогое сравнение не зависит от миллисекунд после оплаты
export function canRenew(periods: readonly AccessPeriod[], now: Date, closedAt: Date | null = null): boolean {
  return closedAt === null && accessState(periods, now).remainingMs <= TOGETHER_PERIOD_MS;
}

export function unusedPaidMs(periods: readonly AccessPeriod[], closedAt: Date): number {
  const closed = closedAt.getTime();
  return totalMs(mergeIntervals(periods.map((p): Interval => [Math.max(p.startsAt.getTime(), closed), p.endsAt.getTime()])));
}
```

Add to `packages/core/src/index.ts` (в конец):

```ts
export * from "./together-access";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/core/src/together-access.test.ts && pnpm --filter @grani/core typecheck`
Expected: все тесты PASS, typecheck без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/together-access.ts packages/core/src/together-access.test.ts packages/core/src/index.ts
git commit -m "feat(core): together access periods, stages and renewal rules"
```

---

### Task 2: Схема БД, миграция, расширение типа покупки

**Files:**
- Modify: `packages/db/src/schema.ts` (вставка после таблицы `pairs`, изменения `productEnum`, `purchases`, новая таблица после `purchases`)
- Create: `packages/db/drizzle/0005_together_spaces.sql` (+ `meta/0005_snapshot.json`, правка `meta/_journal.json`) — генерируется
- Modify: `packages/db/src/purchases.ts`
- Modify: `packages/db/src/testing.ts`
- Modify: `apps/web/src/server/payments-service.ts` (только сужение типов)
- Create: `packages/db/src/together-schema.test.ts`

**Interfaces:**
- Consumes: `PurchaseProduct`, `TOGETHER_PRODUCT` из `@grani/core` (Task 1).
- Produces:
  - таблицы `togetherSpaces`, `togetherMembers`, `togetherInvites`, `togetherAccessPeriods` и колонка `purchases.spaceId`
  - типы `TogetherRole`, `TogetherSpaceStatus`, `TogetherClosedReason` (из `schema.ts`)
  - `type PurchaseTarget = ReportTarget | { spaceId: string }`; `PurchaseRecord.product: PurchaseProduct`, `PurchaseRecord.spaceId: string | null`
  - `createPurchase(db, p: { userId; product: PurchaseProduct; target: PurchaseTarget; amountKopecks; receiptEmail? })`
  - экспорт `toPurchaseRecord(row)`
  - `seedUser(db, p: { externalId; provider?; displayName?; gender? }): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/together-schema.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { purchases, togetherAccessPeriods, togetherInvites, togetherMembers, togetherSpaces } from "./schema";
import { createTestDb, seedUser, seedUserWithResult } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function newSpace(): Promise<string> {
  const [space] = await db.insert(togetherSpaces).values({ status: "pending" }).returning({ id: togetherSpaces.id });
  return space!.id;
}

const member = (spaceId: string, userId: string, role: "initiator" | "partner") => db.insert(togetherMembers).values({ spaceId, userId, role, joinedAt: NOW });

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
  boris = await seedUser(db, { externalId: "boris" });
  vera = await seedUser(db, { externalId: "vera" });
});

describe("together members", () => {
  test("a space cannot get a third member", async () => {
    const spaceId = await newSpace();
    await member(spaceId, anna, "initiator");
    await member(spaceId, boris, "partner");

    await expect(member(spaceId, vera, "partner")).rejects.toThrow();
    await expect(member(spaceId, vera, "initiator")).rejects.toThrow();
  });

  test("a user cannot be an active member of two spaces, but can join again after leaving", async () => {
    const first = await newSpace();
    await member(first, anna, "initiator");

    await expect(member(await newSpace(), anna, "initiator")).rejects.toThrow();

    await db.update(togetherMembers).set({ leftAt: NOW }).where(eq(togetherMembers.spaceId, first));
    await expect(member(await newSpace(), anna, "initiator")).resolves.toBeDefined();
  });
});

describe("together invites", () => {
  const invite = (spaceId: string, tokenHash: string, status: "open" | "requested" | "accepted" | "revoked") =>
    db.insert(togetherInvites).values({ spaceId, tokenHash, inviterId: anna, status, expiresAt: new Date(NOW.getTime() + DAY_MS) });

  test("a space has at most one live invite, but any number of finished ones", async () => {
    const spaceId = await newSpace();
    await invite(spaceId, "h1", "open");

    await expect(invite(spaceId, "h2", "requested")).rejects.toThrow();
    await expect(invite(spaceId, "h3", "revoked")).resolves.toBeDefined();
    await expect(invite(spaceId, "h4", "accepted")).resolves.toBeDefined();
  });

  test("token hashes are unique", async () => {
    await invite(await newSpace(), "same", "revoked");

    await expect(invite(await newSpace(), "same", "revoked")).rejects.toThrow();
  });
});

describe("together spaces", () => {
  test("closed status and closing time go together", async () => {
    const spaceId = await newSpace();

    await expect(db.update(togetherSpaces).set({ status: "closed" }).where(eq(togetherSpaces.id, spaceId))).rejects.toThrow();
    await expect(db.update(togetherSpaces).set({ closedAt: NOW }).where(eq(togetherSpaces.id, spaceId))).rejects.toThrow();
    await expect(db.update(togetherSpaces).set({ status: "closed", closedAt: NOW }).where(eq(togetherSpaces.id, spaceId))).resolves.toBeDefined();
  });
});

describe("purchases and access periods", () => {
  async function spacePurchase(spaceId: string) {
    const [row] = await db
      .insert(purchases)
      .values({ userId: anna, product: "together_30d", spaceId, amountKopecks: 59_900 })
      .returning({ id: purchases.id });
    return row!.id;
  }

  test("a purchase points at no more than one target", async () => {
    const spaceId = await newSpace();
    const { resultId } = await seedUserWithResult(db, { externalId: "with-result" });

    await expect(spacePurchase(spaceId)).resolves.toBeDefined();
    await expect(db.insert(purchases).values({ userId: anna, product: "together_30d", spaceId, resultId, amountKopecks: 1 })).rejects.toThrow();
  });

  test("one purchase cannot be turned into two access periods", async () => {
    const spaceId = await newSpace();
    const purchaseId = await spacePurchase(spaceId);
    const period = { spaceId, purchaseId, startsAt: NOW, endsAt: new Date(NOW.getTime() + 30 * DAY_MS) };
    await db.insert(togetherAccessPeriods).values(period);

    await expect(db.insert(togetherAccessPeriods).values(period)).rejects.toThrow();
  });

  test("a period must end after it starts", async () => {
    const spaceId = await newSpace();

    await expect(
      db.insert(togetherAccessPeriods).values({ spaceId, purchaseId: await spacePurchase(spaceId), startsAt: NOW, endsAt: NOW }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together-schema.test.ts`
Expected: FAIL, нет экспортов `togetherSpaces`/`seedUser`.

- [ ] **Step 3: Write minimal implementation**

3a. `packages/db/src/schema.ts`. Вставить **после таблицы `pairs`** (перед `export const productEnum`):

```ts
export const togetherSpaceStatusEnum = pgEnum("together_space_status", ["pending", "active", "closed"]);
export const togetherClosedReasonEnum = pgEnum("together_closed_reason", ["left", "account_deleted"]);
export const togetherRoleEnum = pgEnum("together_role", ["initiator", "partner"]);
export const togetherInviteStatusEnum = pgEnum("together_invite_status", ["open", "requested", "accepted", "revoked"]);

export type TogetherSpaceStatus = (typeof togetherSpaceStatusEnum.enumValues)[number];
export type TogetherClosedReason = (typeof togetherClosedReasonEnum.enumValues)[number];
export type TogetherRole = (typeof togetherRoleEnum.enumValues)[number];

// Пространство пары «Вдвоём» не связано с results и pairs: тест для него не нужен
export const togetherSpaces = pgTable(
  "together_spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: togetherSpaceStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedReason: togetherClosedReasonEnum("closed_reason"),
  },
  (t) => [check("together_spaces_closed_consistent", sql`(${t.status} = 'closed') = (${t.closedAt} is not null)`)],
);

export const togetherMembers = pgTable(
  "together_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: togetherRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    // Не больше двух участников: по одному на роль
    uniqueIndex("together_members_space_role_uq").on(t.spaceId, t.role),
    uniqueIndex("together_members_space_user_uq").on(t.spaceId, t.userId),
    // Один активный кабинет на человека
    uniqueIndex("together_members_active_user_uq")
      .on(t.userId)
      .where(sql`${t.leftAt} is null`),
  ],
);

export const togetherInvites = pgTable(
  "together_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    // Сам токен не хранится: по хешу ссылку найти можно, из базы её не восстановить
    tokenHash: text("token_hash").notNull().unique(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id),
    status: togetherInviteStatusEnum("status").notNull().default("open"),
    requesterUserId: uuid("requester_user_id").references(() => users.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Одна живая ссылка на пространство; завершённых может быть сколько угодно
    uniqueIndex("together_invites_live_uq")
      .on(t.spaceId)
      .where(sql`${t.status} in ('open', 'requested')`),
  ],
);
```

В `productEnum` добавить значение:

```ts
export const productEnum = pgEnum("product", [
  "full",
  "chapter_money",
  "chapter_conflict",
  "chapter_stress",
  "chapter_relationships",
  "chapters_all",
  "pair",
  "together_30d",
]);
```

В `purchases` добавить колонку после `pairId`:

```ts
    spaceId: uuid("space_id").references(() => togetherSpaces.id, { onDelete: "set null" }),
```

В индексах и check `purchases` заменить блок на:

```ts
  (t) => [
    index("purchases_result_idx").on(t.resultId),
    index("purchases_pair_idx").on(t.pairId),
    index("purchases_space_idx").on(t.spaceId),
    index("purchases_user_idx").on(t.userId, t.createdAt),
    check("purchases_at_most_one_target", sql`num_nonnulls(${t.resultId}, ${t.pairId}, ${t.spaceId}) <= 1`),
  ],
```

Сразу **после** таблицы `purchases` добавить:

```ts
// Журнал оплаченных интервалов: уникальный purchase_id делает выдачу доступа идемпотентной
export const togetherAccessPeriods = pgTable(
  "together_access_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => togetherSpaces.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .unique()
      .references(() => purchases.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("together_access_periods_space_idx").on(t.spaceId, t.startsAt), check("together_access_periods_positive", sql`${t.endsAt} > ${t.startsAt}`)],
);
```

3b. Сгенерировать миграцию (существующие файлы не править):

Run: `pnpm --filter @grani/db db:generate --name=together_spaces`
Expected: создан `packages/db/drizzle/0005_together_spaces.sql`, `meta/0005_snapshot.json`, обновлён `meta/_journal.json`. Открыть SQL и убедиться, что есть `CREATE TYPE` для четырёх enum, четыре `CREATE TABLE`, `ALTER TYPE "public"."product" ADD VALUE 'together_30d'`, `ALTER TABLE "purchases" ADD COLUMN "space_id"`, замена constraint `purchases_at_most_one_target`. `git status` показывает только новые файлы миграции, `_journal.json` и `schema.ts`.

3c. `packages/db/src/purchases.ts`: заменить импорты, типы и функции создания (остальное без изменений):

```ts
import type { Product, PurchaseProduct } from "@grani/core";
import { and, asc, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { targetColumns, targetId, type ReportTarget } from "./reports";
import { purchases, type PurchaseStatus } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type { PurchaseStatus } from "./schema";
export type PurchaseTarget = ReportTarget | { spaceId: string };
export type PurchaseRecord = {
  id: string;
  userId: string;
  product: PurchaseProduct;
  resultId: string | null;
  pairId: string | null;
  spaceId: string | null;
  amountKopecks: number;
  status: PurchaseStatus;
  yookassaPaymentId: string | null;
  confirmationUrl: string | null;
  createdAt: Date;
  paidAt: Date | null;
  receiptEmail: string | null;
  receiptSentAt: Date | null;
};

type PurchaseRow = typeof purchases.$inferSelect;

export const toPurchaseRecord = (row: PurchaseRow): PurchaseRecord => ({ ...row, product: row.product as PurchaseProduct });

function targetWhere(target: ReportTarget) {
  return "resultId" in target ? eq(purchases.resultId, target.resultId) : eq(purchases.pairId, target.pairId);
}

function purchaseTargetColumns(target: PurchaseTarget): { resultId: string | null; pairId: string | null; spaceId: string | null } {
  return "spaceId" in target ? { resultId: null, pairId: null, spaceId: target.spaceId } : { ...targetColumns(target), spaceId: null };
}

export async function createPurchase(
  db: Database,
  p: { userId: string; product: PurchaseProduct; target: PurchaseTarget; amountKopecks: number; receiptEmail?: string | null },
): Promise<PurchaseRecord> {
  const [row] = await db
    .insert(purchases)
    .values({ userId: p.userId, product: p.product, ...purchaseTargetColumns(p.target), amountKopecks: p.amountKopecks, receiptEmail: p.receiptEmail ?? null })
    .returning();
  return toPurchaseRecord(row!);
}
```

Дальше в файле заменить все вызовы `toRecord(` на `toPurchaseRecord(`, а в `ReceiptToSend` заменить `product: Product` на `product: PurchaseProduct`, и в `listReceiptsToSend` привести: `rows.map((row) => ({ ...row, product: row.product as PurchaseProduct }))`. В `listOwnedProducts` оставить `Product`: `rows.map((row) => row.product as Product)`.
3d. `packages/db/src/testing.ts`: добавить `seedUser` и использовать его в `seedUserWithResult`:

```ts
// Пользователь с согласием без результатов — для пространств «Вдвоём» тест не нужен
export async function seedUser(
  db: Database,
  p: { externalId: string; provider?: AuthProvider; displayName?: string; gender?: KnownGender | null },
): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: p.provider ?? "telegram", externalId: p.externalId, displayName: p.displayName ?? p.externalId, gender: p.gender ?? null },
    { version: "test", at: new Date("2026-09-17T10:00:00Z") },
  );
  if (!outcome.ok) throw new Error("seed user was not created");
  return outcome.user.id;
}
```

и тело `seedUserWithResult` начать так (убрав прежний `upsertUserFromIdentity`-блок):

```ts
  const userId = await seedUser(db, p);
  const scores = p.scores ?? DEFAULT_SCORES;
  const result = await createResult(db, {
    userId,
    answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 3 as const])),
    scores,
    typeCode: typeCodeOf(scores),
    stability: stabilityOf(scores),
  });
  return { userId, resultId: result.id };
```

3e. `apps/web/src/server/payments-service.ts` (сужение типов, поведение прежнее):
- В импорте из `@grani/core` добавить `type PurchaseProduct`.
- `PRODUCT_DESCRIPTIONS: Readonly<Record<PurchaseProduct, string>>` и добавить ключ `together_30d: "Доступ к «Грани. Вдвоём» на 30 дней для двоих",`.
- В `enqueuePaid` после `if (!target) return;` добавить `if (!isProduct(purchase.product)) return;`.
- В `getPurchaseView` сразу после строки `if (purchase.status === "pending" && purchase.yookassaPaymentId) purchase = ...` добавить `if (!isProduct(purchase.product)) return null;`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: все тесты `db` PASS (включая прежние), typecheck всех пакетов без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/web/src/server/payments-service.ts
git commit -m "feat(db): together spaces schema, access periods and space purchases"
```

---

### Task 3: Репозиторий пространства, приглашений и выхода

**Files:**
- Create: `packages/db/src/together.ts`
- Create: `packages/db/src/together.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/delete-user.ts`
- Modify: `packages/db/src/delete-user.test.ts`
- Modify: `packages/db/src/testing.ts`

**Interfaces:**
- Consumes: таблицы и типы Task 2; `TOGETHER_INVITE_TTL_MS` (Task 1); `createInviteToken`, `isInviteToken` (`./tokens`); `getUser` (`./users`); `isUuid`.
- Produces (все функции первым аргументом принимают `db: Database`):
  - `hashInviteToken(token: string): string`
  - `createSpace(db, p: { userId: string; now: Date }): Promise<{ ok: true; spaceId: string; token: string } | { ok: false; reason: "already_in_space" }>`
  - `reissueInvite(db, p: { userId: string; now: Date }): Promise<{ ok: true; token: string } | { ok: false; reason: "not_found" | "not_pending" }>`
  - `peekInvite(db, token: string, now: Date): Promise<boolean>`
  - `requestJoin(db, p: { token: string; userId: string; now: Date }): Promise<{ ok: true; status: "requested" } | { ok: false; reason: "invalid" | "own_invite" | "already_in_space" }>`
  - `getPendingRequest(db, p: { userId: string; now: Date }): Promise<{ requesterUserId: string; displayName: string; requestedAt: Date } | null>`
  - `respondToRequest(db, p: { userId: string; accept: boolean; now: Date }): Promise<{ ok: true; status: "accepted" | "declined" } | { ok: false; reason: "not_found" | "no_request" | "requester_unavailable" }>`
  - `closeSpaceForUser(db, p: { userId: string; now: Date; reason: TogetherClosedReason }): Promise<{ ok: true; spaceId: string } | { ok: false; reason: "not_found" }>`
  - `getActiveSpaceForUser(db, userId: string): Promise<SpaceSnapshot | null>` где `SpaceSnapshot = { space: SpaceRecord; members: MemberRecord[] }`, `SpaceRecord = { id; status: TogetherSpaceStatus; createdAt; closedAt; closedReason }`, `MemberRecord = { userId; role: TogetherRole; displayName; joinedAt }`
  - `seedTogetherSpace(db, p?: { now?: Date }): Promise<{ spaceId; initiatorId; partnerId }>` (в `testing.ts`)

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/together.test.ts`:

```ts
import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import {
  closeSpaceForUser,
  createSpace,
  getActiveSpaceForUser,
  getPendingRequest,
  hashInviteToken,
  peekInvite,
  reissueInvite,
  requestJoin,
  respondToRequest,
} from "./together";
import { togetherInvites, togetherSpaces, users } from "./schema";
import { createTestDb, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const AFTER_TTL = new Date(NOW.getTime() + TOGETHER_INVITE_TTL_MS + 1);

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function create(userId = anna) {
  const outcome = await createSpace(db, { userId, now: NOW });
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome;
}

async function makeActive() {
  const { spaceId, token } = await create();
  await requestJoin(db, { token, userId: boris, now: NOW });
  await respondToRequest(db, { userId: anna, accept: true, now: NOW });
  return { spaceId, token };
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("createSpace", () => {
  test("creates a pending space with the creator as initiator and stores only the token hash", async () => {
    const { spaceId, token } = await create();

    const snapshot = await getActiveSpaceForUser(db, anna);
    expect(snapshot?.space).toMatchObject({ id: spaceId, status: "pending" });
    expect(snapshot?.members).toMatchObject([{ userId: anna, role: "initiator", displayName: "Аня" }]);
    const [stored] = await db.select().from(togetherInvites).where(eq(togetherInvites.spaceId, spaceId));
    expect(stored?.tokenHash).toBe(hashInviteToken(token));
    expect(stored?.tokenHash).not.toBe(token);
  });

  test("refuses a second space for the same user, however many times it is asked", async () => {
    await create();

    expect(await createSpace(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await createSpace(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await db.select().from(togetherSpaces)).toHaveLength(1);
  });

  test("lets a user start a new space after leaving the previous one", async () => {
    await create();
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect((await createSpace(db, { userId: anna, now: NOW })).ok).toBe(true);
  });
});

describe("peekInvite", () => {
  test("is valid only for an open, unexpired, known token", async () => {
    const { token } = await create();

    expect(await peekInvite(db, token, NOW)).toBe(true);
    expect(await peekInvite(db, "not-a-token", NOW)).toBe(false);
    expect(await peekInvite(db, "A".repeat(24), NOW)).toBe(false);
    expect(await peekInvite(db, token, AFTER_TTL)).toBe(false);
  });

  test("is not valid once someone has asked to join", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await peekInvite(db, token, NOW)).toBe(false);
  });
});

describe("requestJoin", () => {
  test("moves the invite to requested and is idempotent for the same user", async () => {
    const { token } = await create();

    expect(await requestJoin(db, { token, userId: boris, now: NOW })).toEqual({ ok: true, status: "requested" });
    expect(await requestJoin(db, { token, userId: boris, now: NOW })).toEqual({ ok: true, status: "requested" });
  });

  test("refuses the inviter, someone with a space of their own, expired and unknown links", async () => {
    const { token } = await create();
    await create(vera);

    expect(await requestJoin(db, { token, userId: anna, now: NOW })).toEqual({ ok: false, reason: "own_invite" });
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "already_in_space" });
    expect(await requestJoin(db, { token, userId: boris, now: AFTER_TTL })).toEqual({ ok: false, reason: "invalid" });
    expect(await requestJoin(db, { token: "x".repeat(24), userId: boris, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    expect(await requestJoin(db, { token: "short", userId: boris, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  test("a second person gets a neutral refusal while another request waits and after the space is full", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "invalid" });

    await respondToRequest(db, { userId: anna, accept: true, now: NOW });
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("getPendingRequest", () => {
  test("shows the requester to the inviter only while the request is live", async () => {
    const { token } = await create();
    expect(await getPendingRequest(db, { userId: anna, now: NOW })).toBeNull();

    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await getPendingRequest(db, { userId: anna, now: NOW })).toMatchObject({ requesterUserId: boris, displayName: "Борис" });
    expect(await getPendingRequest(db, { userId: boris, now: NOW })).toBeNull();
    expect(await getPendingRequest(db, { userId: anna, now: AFTER_TTL })).toBeNull();
  });
});

describe("respondToRequest", () => {
  test("accepting makes the requester the partner and activates the space", async () => {
    const { spaceId } = await makeActive();

    const snapshot = await getActiveSpaceForUser(db, boris);
    expect(snapshot?.space).toMatchObject({ id: spaceId, status: "active" });
    expect(snapshot?.members.map((m) => [m.role, m.displayName])).toEqual([
      ["initiator", "Аня"],
      ["partner", "Борис"],
    ]);
  });

  test("declining reopens the invite for someone else", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await respondToRequest(db, { userId: anna, accept: false, now: NOW })).toEqual({ ok: true, status: "declined" });
    expect(await getActiveSpaceForUser(db, boris)).toBeNull();
    expect(await peekInvite(db, token, NOW)).toBe(true);
    expect(await requestJoin(db, { token, userId: vera, now: NOW })).toEqual({ ok: true, status: "requested" });
  });

  test("answers no_request without a request, and not_found for someone who is not an initiator", async () => {
    await create();
    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "no_request" });
    expect(await respondToRequest(db, { userId: vera, accept: true, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });

  test("a partner cannot answer requests", async () => {
    await makeActive();

    expect(await respondToRequest(db, { userId: boris, accept: true, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });

  test("does not accept an expired request", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });

    expect(await respondToRequest(db, { userId: anna, accept: true, now: AFTER_TTL })).toEqual({ ok: false, reason: "no_request" });
  });

  test("refuses a requester who has meanwhile started a space of their own, and reopens the invite", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });
    await create(boris);

    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "requester_unavailable" });
    expect(await peekInvite(db, token, NOW)).toBe(true);
  });

  test("refuses a requester whose account was deleted", async () => {
    const { token } = await create();
    await requestJoin(db, { token, userId: boris, now: NOW });
    await db.update(users).set({ deletedAt: NOW }).where(eq(users.id, boris));

    expect(await respondToRequest(db, { userId: anna, accept: true, now: NOW })).toEqual({ ok: false, reason: "requester_unavailable" });
  });
});

describe("reissueInvite", () => {
  test("revokes the old link and gives a new one while nobody has joined", async () => {
    const { token } = await create();

    const outcome = await reissueInvite(db, { userId: anna, now: NOW });

    expect(outcome.ok).toBe(true);
    expect(await peekInvite(db, token, NOW)).toBe(false);
    expect(await peekInvite(db, outcome.ok ? outcome.token : "", NOW)).toBe(true);
  });

  test("refuses once the space is active and for people without a space", async () => {
    await makeActive();

    expect(await reissueInvite(db, { userId: anna, now: NOW })).toEqual({ ok: false, reason: "not_pending" });
    expect(await reissueInvite(db, { userId: vera, now: NOW })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("closeSpaceForUser", () => {
  test("closes the space for both, frees both and revokes live invites", async () => {
    const { spaceId } = await makeActive();

    expect(await closeSpaceForUser(db, { userId: boris, now: NOW, reason: "left" })).toEqual({ ok: true, spaceId });

    const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId));
    expect(space).toMatchObject({ status: "closed", closedBy: boris, closedReason: "left", closedAt: NOW });
    expect(await getActiveSpaceForUser(db, anna)).toBeNull();
    expect(await getActiveSpaceForUser(db, boris)).toBeNull();
    expect((await createSpace(db, { userId: anna, now: NOW })).ok).toBe(true);
    expect((await createSpace(db, { userId: boris, now: NOW })).ok).toBe(true);
  });

  test("revokes a waiting link when a pending space is closed", async () => {
    const { token } = await create();

    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect(await peekInvite(db, token, NOW)).toBe(false);
  });

  test("a repeat call and an outsider get not_found", async () => {
    await makeActive();
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect(await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" })).toEqual({ ok: false, reason: "not_found" });
    expect(await closeSpaceForUser(db, { userId: vera, now: NOW, reason: "left" })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("getActiveSpaceForUser", () => {
  test("shows a space only to its own members", async () => {
    await makeActive();

    expect(await getActiveSpaceForUser(db, anna)).not.toBeNull();
    expect(await getActiveSpaceForUser(db, vera)).toBeNull();
    expect(await getActiveSpaceForUser(db, "not-a-uuid")).toBeNull();
  });
});
```

Дополнить `packages/db/src/delete-user.test.ts` (в конец `describe("deleteUserData", ...)` перед закрывающей `});`, импортируя `seedTogetherSpace` из `./testing`, `togetherSpaces` из `./schema`, `createSpace` из `./together`):

```ts
  it("closes the together space of the deleted user and frees the partner", async () => {
    const { spaceId, initiatorId, partnerId } = await seedTogetherSpace(db);

    expect(await deleteUserData(db, initiatorId)).toEqual({ deleted: true });

    const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId));
    expect(space).toMatchObject({ status: "closed", closedReason: "account_deleted" });
    expect((await createSpace(db, { userId: partnerId, now: new Date("2026-10-06T10:00:00Z") })).ok).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together.test.ts packages/db/src/delete-user.test.ts`
Expected: FAIL, `./together` не существует; `seedTogetherSpace` не экспортирован.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/together.ts`:

```ts
import { createHash } from "node:crypto";
import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  togetherInvites,
  togetherMembers,
  togetherSpaces,
  users,
  type TogetherClosedReason,
  type TogetherRole,
  type TogetherSpaceStatus,
} from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import type { Database } from "./types";
import { getUser } from "./users";
import { isUuid } from "./uuid";

export type SpaceRecord = { id: string; status: TogetherSpaceStatus; createdAt: Date; closedAt: Date | null; closedReason: TogetherClosedReason | null };
export type MemberRecord = { userId: string; role: TogetherRole; displayName: string; joinedAt: Date };
export type SpaceSnapshot = { space: SpaceRecord; members: MemberRecord[] };
export type PendingRequest = { requesterUserId: string; displayName: string; requestedAt: Date };
export type CreateSpaceOutcome = { ok: true; spaceId: string; token: string } | { ok: false; reason: "already_in_space" };
export type ReissueOutcome = { ok: true; token: string } | { ok: false; reason: "not_found" | "not_pending" };
export type RequestOutcome = { ok: true; status: "requested" } | { ok: false; reason: "invalid" | "own_invite" | "already_in_space" };
export type RespondOutcome = { ok: true; status: "accepted" | "declined" } | { ok: false; reason: "not_found" | "no_request" | "requester_unavailable" };
export type CloseOutcome = { ok: true; spaceId: string } | { ok: false; reason: "not_found" };

const LIVE_INVITE_STATUSES = ["open", "requested"] as const;

export const hashInviteToken = (token: string): string => createHash("sha256").update(token).digest("hex");

// Порядок блокировок во всех операциях один: пользователь → пространство → приглашение.
// Так одновременные запросы выстраиваются в очередь и не ждут друг друга по кругу
async function lockUser(tx: Database, userId: string): Promise<void> {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
}

async function lockSpace(tx: Database, spaceId: string) {
  const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId)).for("update");
  return space ?? null;
}

async function hasActiveMembership(tx: Database, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: togetherMembers.id })
    .from(togetherMembers)
    .where(and(eq(togetherMembers.userId, userId), isNull(togetherMembers.leftAt)))
    .limit(1);
  return row !== undefined;
}

async function findActiveMembership(tx: Database, userId: string, role?: TogetherRole): Promise<{ spaceId: string } | null> {
  const conditions = [eq(togetherMembers.userId, userId), isNull(togetherMembers.leftAt)];
  if (role) conditions.push(eq(togetherMembers.role, role));
  const [row] = await tx.select({ spaceId: togetherMembers.spaceId }).from(togetherMembers).where(and(...conditions)).limit(1);
  return row ?? null;
}

async function insertOpenInvite(tx: Database, p: { spaceId: string; inviterId: string; now: Date }): Promise<string> {
  const token = createInviteToken();
  await tx.insert(togetherInvites).values({
    spaceId: p.spaceId,
    tokenHash: hashInviteToken(token),
    inviterId: p.inviterId,
    expiresAt: new Date(p.now.getTime() + TOGETHER_INVITE_TTL_MS),
  });
  return token;
}

async function revokeLiveInvites(tx: Database, spaceId: string): Promise<void> {
  await tx
    .update(togetherInvites)
    .set({ status: "revoked" })
    .where(and(eq(togetherInvites.spaceId, spaceId), inArray(togetherInvites.status, LIVE_INVITE_STATUSES)));
}

async function reopenInvite(tx: Database, inviteId: string): Promise<void> {
  await tx.update(togetherInvites).set({ status: "open", requesterUserId: null, requestedAt: null }).where(eq(togetherInvites.id, inviteId));
}

export async function createSpace(db: Database, p: { userId: string; now: Date }): Promise<CreateSpaceOutcome> {
  return db.transaction(async (tx): Promise<CreateSpaceOutcome> => {
    await lockUser(tx, p.userId);
    if (await hasActiveMembership(tx, p.userId)) return { ok: false, reason: "already_in_space" };
    const [space] = await tx.insert(togetherSpaces).values({ status: "pending" }).returning({ id: togetherSpaces.id });
    await tx.insert(togetherMembers).values({ spaceId: space!.id, userId: p.userId, role: "initiator", joinedAt: p.now });
    const token = await insertOpenInvite(tx, { spaceId: space!.id, inviterId: p.userId, now: p.now });
    return { ok: true, spaceId: space!.id, token };
  });
}

export async function reissueInvite(db: Database, p: { userId: string; now: Date }): Promise<ReissueOutcome> {
  return db.transaction(async (tx): Promise<ReissueOutcome> => {
    await lockUser(tx, p.userId);
    const membership = await findActiveMembership(tx, p.userId, "initiator");
    if (!membership) return { ok: false, reason: "not_found" };
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status !== "pending") return { ok: false, reason: "not_pending" };
    await revokeLiveInvites(tx, space.id);
    return { ok: true, token: await insertOpenInvite(tx, { spaceId: space.id, inviterId: p.userId, now: p.now }) };
  });
}

// Публичная проверка ссылки: годна только открытая и непросроченная; причину отказа не раскрываем
export async function peekInvite(db: Database, token: string, now: Date): Promise<boolean> {
  if (!isInviteToken(token)) return false;
  const [invite] = await db.select().from(togetherInvites).where(eq(togetherInvites.tokenHash, hashInviteToken(token))).limit(1);
  return invite !== undefined && invite.status === "open" && invite.expiresAt > now;
}

export async function requestJoin(db: Database, p: { token: string; userId: string; now: Date }): Promise<RequestOutcome> {
  if (!isInviteToken(p.token)) return { ok: false, reason: "invalid" };
  return db.transaction(async (tx): Promise<RequestOutcome> => {
    await lockUser(tx, p.userId);
    const [invite] = await tx.select().from(togetherInvites).where(eq(togetherInvites.tokenHash, hashInviteToken(p.token))).for("update");
    const usable = invite && (invite.status === "open" || invite.status === "requested") && invite.expiresAt > p.now;
    if (!invite || !usable) return { ok: false, reason: "invalid" };
    if (invite.inviterId === p.userId) return { ok: false, reason: "own_invite" };
    if (invite.status === "requested") return invite.requesterUserId === p.userId ? { ok: true, status: "requested" } : { ok: false, reason: "invalid" };
    if (await hasActiveMembership(tx, p.userId)) return { ok: false, reason: "already_in_space" };
    await tx.update(togetherInvites).set({ status: "requested", requesterUserId: p.userId, requestedAt: p.now }).where(eq(togetherInvites.id, invite.id));
    return { ok: true, status: "requested" };
  });
}

export async function getPendingRequest(db: Database, p: { userId: string; now: Date }): Promise<PendingRequest | null> {
  const membership = await findActiveMembership(db, p.userId, "initiator");
  if (!membership) return null;
  const [invite] = await db
    .select()
    .from(togetherInvites)
    .where(and(eq(togetherInvites.spaceId, membership.spaceId), eq(togetherInvites.status, "requested")))
    .limit(1);
  if (!invite?.requesterUserId || !invite.requestedAt || invite.expiresAt <= p.now) return null;
  const requester = await getUser(db, invite.requesterUserId);
  return requester ? { requesterUserId: requester.id, displayName: requester.displayName, requestedAt: invite.requestedAt } : null;
}

async function requesterCanJoin(tx: Database, requesterId: string): Promise<boolean> {
  const [user] = await tx.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, requesterId)).limit(1);
  return user !== undefined && user.deletedAt === null && !(await hasActiveMembership(tx, requesterId));
}

export async function respondToRequest(db: Database, p: { userId: string; accept: boolean; now: Date }): Promise<RespondOutcome> {
  return db.transaction(async (tx): Promise<RespondOutcome> => {
    const membership = await findActiveMembership(tx, p.userId, "initiator");
    if (!membership) return { ok: false, reason: "not_found" };
    const [seen] = await tx
      .select()
      .from(togetherInvites)
      .where(and(eq(togetherInvites.spaceId, membership.spaceId), eq(togetherInvites.status, "requested")))
      .limit(1);
    if (!seen?.requesterUserId) return { ok: false, reason: "no_request" };
    const requesterId = seen.requesterUserId;
    // Блокируем в общем порядке: запросивший → пространство → приглашение, затем перечитываем состояние
    await lockUser(tx, requesterId);
    const space = await lockSpace(tx, membership.spaceId);
    const [invite] = await tx.select().from(togetherInvites).where(eq(togetherInvites.id, seen.id)).for("update");
    if (!space || space.status !== "pending") return { ok: false, reason: "no_request" };
    if (!invite || invite.status !== "requested" || invite.requesterUserId !== requesterId || invite.expiresAt <= p.now) return { ok: false, reason: "no_request" };
    if (!p.accept) {
      await reopenInvite(tx, invite.id);
      return { ok: true, status: "declined" };
    }
    if (!(await requesterCanJoin(tx, requesterId))) {
      await reopenInvite(tx, invite.id);
      return { ok: false, reason: "requester_unavailable" };
    }
    await tx.insert(togetherMembers).values({ spaceId: space.id, userId: requesterId, role: "partner", joinedAt: p.now });
    await tx.update(togetherSpaces).set({ status: "active" }).where(eq(togetherSpaces.id, space.id));
    await tx.update(togetherInvites).set({ status: "accepted", confirmedAt: p.now }).where(eq(togetherInvites.id, invite.id));
    return { ok: true, status: "accepted" };
  });
}

export async function closeSpaceForUser(db: Database, p: { userId: string; now: Date; reason: TogetherClosedReason }): Promise<CloseOutcome> {
  return db.transaction(async (tx): Promise<CloseOutcome> => {
    await lockUser(tx, p.userId);
    const membership = await findActiveMembership(tx, p.userId);
    if (!membership) return { ok: false, reason: "not_found" };
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status === "closed") return { ok: false, reason: "not_found" };
    await tx
      .update(togetherSpaces)
      .set({ status: "closed", closedAt: p.now, closedBy: p.userId, closedReason: p.reason })
      .where(eq(togetherSpaces.id, space.id));
    // Оба участника освобождаются: в закрытом пространстве активных нет
    await tx.update(togetherMembers).set({ leftAt: p.now }).where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt)));
    await revokeLiveInvites(tx, space.id);
    return { ok: true, spaceId: space.id };
  });
}

export async function getActiveSpaceForUser(db: Database, userId: string): Promise<SpaceSnapshot | null> {
  if (!isUuid(userId)) return null;
  const membership = await findActiveMembership(db, userId);
  if (!membership) return null;
  const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, membership.spaceId)).limit(1);
  if (!space || space.status === "closed") return null;
  const rows = await db
    .select()
    .from(togetherMembers)
    .where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt)))
    .orderBy(asc(togetherMembers.joinedAt), asc(togetherMembers.role));
  const members = await Promise.all(
    rows.map(async (row): Promise<MemberRecord | null> => {
      const user = await getUser(db, row.userId);
      return user ? { userId: row.userId, role: row.role, displayName: user.displayName, joinedAt: row.joinedAt } : null;
    }),
  );
  return {
    space: { id: space.id, status: space.status, createdAt: space.createdAt, closedAt: space.closedAt, closedReason: space.closedReason },
    members: members.filter((member): member is MemberRecord => member !== null),
  };
}
```

Примечание для исполнителя: порядок участников в тесте `[["initiator","Аня"],["partner","Борис"]]` зависит от `joinedAt`; в тесте обе метки времени равны `NOW`, поэтому второй ключ сортировки по `role` (в enum `initiator` идёт раньше `partner`) делает порядок детерминированным. Если сортировка по enum даст иной порядок, заменить второй ключ на `sql\`${togetherMembers.role} = 'partner'\``.

`packages/db/src/index.ts` — добавить строку `export * from "./together";`.

`packages/db/src/delete-user.ts` — импортировать `closeSpaceForUser` и вызвать внутри транзакции перед удалением идентификаций:

```ts
import { closeSpaceForUser } from "./together";
```
```ts
    await tx.delete(results).where(eq(results.userId, userId));
    // Совместное пространство закрывается: партнёр освобождается, записи об оплатах остаются
    await closeSpaceForUser(tx, { userId, now: new Date(), reason: "account_deleted" });
    await tx.delete(authIdentities).where(eq(authIdentities.userId, userId));
```
Одновременно в комментарий над функцией добавить фразу «закрывает пространство «Вдвоём»».

`packages/db/src/testing.ts` — добавить `seedTogetherSpace` и импорт `createSpace, requestJoin, respondToRequest` из `./together`:

```ts
// Активное пространство «Вдвоём» из двух новых пользователей — для тестов оплаты и сервисов
export async function seedTogetherSpace(
  db: Database,
  p: { now?: Date } = {},
): Promise<{ spaceId: string; initiatorId: string; partnerId: string }> {
  const now = p.now ?? new Date("2026-10-05T10:00:00Z");
  const suffix = Math.random().toString(36).slice(2, 10);
  const initiatorId = await seedUser(db, { externalId: `tg-a-${suffix}`, displayName: "Аня" });
  const partnerId = await seedUser(db, { externalId: `tg-b-${suffix}`, displayName: "Борис" });
  const created = await createSpace(db, { userId: initiatorId, now });
  if (!created.ok) throw new Error(`seed space was not created: ${created.reason}`);
  const requested = await requestJoin(db, { token: created.token, userId: partnerId, now });
  if (!requested.ok) throw new Error(`seed request failed: ${requested.reason}`);
  const responded = await respondToRequest(db, { userId: initiatorId, accept: true, now });
  if (!responded.ok) throw new Error(`seed confirmation failed: ${responded.reason}`);
  return { spaceId: created.spaceId, initiatorId, partnerId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS. Если `tx` не принимается как `Database` в `closeSpaceForUser(tx, …)`, использовать приведение `tx as unknown as Database` ровно в этом месте (как уже сделано для `createTestDb`) и оставить комментарий почему.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): together spaces, invites with confirmation and leaving"
```

---

### Task 4: Журнал доступа, резерв покупки и списки владельца

**Files:**
- Create: `packages/db/src/together-billing.ts`
- Create: `packages/db/src/together-billing.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `nextPeriod`, `canRenew`, `unusedPaidMs`, `TOGETHER_PRODUCT`, `AccessPeriod` (Task 1); таблицы (Task 2); `createPurchase`, `markPurchaseSucceeded`, `toPurchaseRecord`, `PurchaseRecord` (`./purchases`); `closeSpaceForUser` (Task 3).
- Produces:
  - `listAccessPeriods(db, spaceId: string): Promise<AccessPeriod[]>`
  - `getAccessSnapshot(db, spaceId: string): Promise<{ periods: AccessPeriod[]; closedAt: Date | null }>`
  - `grantAccessPeriod(db, p: { spaceId: string; purchaseId: string; paidAt: Date }): Promise<{ ok: true; created: boolean; period: AccessPeriod } | { ok: false; reason: "space_not_found" | "space_closed" }>`
  - `hasAccessPeriod(db, purchaseId: string): Promise<boolean>`
  - `reserveSpacePurchase(db, p: { spaceId: string; userId: string; amountKopecks: number; receiptEmail: string; now: Date; reuseSince: Date }): Promise<{ kind: "reused" | "created"; purchase: PurchaseRecord } | { kind: "not_available" }>`
  - `listPaidWithoutAccess(db): Promise<PaidWithoutAccess[]>` где `PaidWithoutAccess = { purchaseId; spaceId: string | null; userId; paidAt: Date | null; amountKopecks }`
  - `listClosedWithRemaining(db): Promise<ClosedWithRemaining[]>` где `ClosedWithRemaining = { spaceId; closedAt: Date; closedReason: TogetherClosedReason | null; remainingDays: number }`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/together-billing.test.ts`:

```ts
import { TOGETHER_PRICE_KOPECKS, TOGETHER_PRODUCT } from "@grani/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { createPurchase, markPurchaseSucceeded } from "./purchases";
import { purchases } from "./schema";
import {
  getAccessSnapshot,
  grantAccessPeriod,
  hasAccessPeriod,
  listAccessPeriods,
  listClosedWithRemaining,
  listPaidWithoutAccess,
  reserveSpacePurchase,
} from "./together-billing";
import { closeSpaceForUser } from "./together";
import { createTestDb, seedTogetherSpace } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

let db: Database;
let space: { spaceId: string; initiatorId: string; partnerId: string };

async function paidPurchase(paidAt: Date, userId = space.initiatorId) {
  const purchase = await createPurchase(db, {
    userId,
    product: TOGETHER_PRODUCT,
    target: { spaceId: space.spaceId },
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: "anna@example.ru",
  });
  await markPurchaseSucceeded(db, purchase.id, paidAt);
  return purchase.id;
}

const reserve = (now: Date, userId = space.initiatorId) =>
  reserveSpacePurchase(db, {
    spaceId: space.spaceId,
    userId,
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: "anna@example.ru",
    now,
    reuseSince: new Date(now.getTime() - 30 * 60_000),
  });

beforeEach(async () => {
  db = await createTestDb();
  space = await seedTogetherSpace(db);
});

describe("grantAccessPeriod", () => {
  test("gives a 30-day period starting at the payment time", async () => {
    const purchaseId = await paidPurchase(NOW);

    const outcome = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW });

    expect(outcome).toEqual({ ok: true, created: true, period: { startsAt: NOW, endsAt: days(30) } });
    expect(await hasAccessPeriod(db, purchaseId)).toBe(true);
  });

  test("granting the same purchase again changes nothing", async () => {
    const purchaseId = await paidPurchase(NOW);
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW });

    const again = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: days(5) });

    expect(again).toMatchObject({ ok: true, created: false, period: { startsAt: NOW, endsAt: days(30) } });
    expect(await listAccessPeriods(db, space.spaceId)).toHaveLength(1);
  });

  test("an early payment extends access after the current period without overlap", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    const second = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(days(10)), paidAt: days(10) });

    expect(second).toMatchObject({ ok: true, created: true, period: { startsAt: days(30), endsAt: days(60) } });
  });

  test("a payment after a gap starts at the payment time", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    const late = await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(days(45)), paidAt: days(45) });

    expect(late).toMatchObject({ ok: true, period: { startsAt: days(45), endsAt: days(75) } });
  });

  test("gives nothing to a closed space and to an unknown one", async () => {
    const purchaseId = await paidPurchase(NOW);
    await closeSpaceForUser(db, { userId: space.partnerId, now: NOW, reason: "left" });

    expect(await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId, paidAt: NOW })).toEqual({ ok: false, reason: "space_closed" });
    expect(await grantAccessPeriod(db, { spaceId: "00000000-0000-4000-8000-000000000001", purchaseId, paidAt: NOW })).toEqual({ ok: false, reason: "space_not_found" });
    expect(await hasAccessPeriod(db, purchaseId)).toBe(false);
  });
});

describe("getAccessSnapshot", () => {
  test("returns the periods and the closing time", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    expect(await getAccessSnapshot(db, space.spaceId)).toEqual({ periods: [{ startsAt: NOW, endsAt: days(30) }], closedAt: null });

    await closeSpaceForUser(db, { userId: space.initiatorId, now: days(3), reason: "left" });

    expect((await getAccessSnapshot(db, space.spaceId)).closedAt).toEqual(days(3));
  });
});

describe("reserveSpacePurchase", () => {
  test("creates a pending purchase for the space", async () => {
    const outcome = await reserve(NOW);

    expect(outcome.kind).toBe("created");
    if (outcome.kind === "created") {
      expect(outcome.purchase).toMatchObject({ spaceId: space.spaceId, userId: space.initiatorId, product: TOGETHER_PRODUCT, status: "pending", amountKopecks: TOGETHER_PRICE_KOPECKS });
    }
  });

  test("reuses a recent unfinished purchase that already has a payment page, for either member", async () => {
    const first = await reserve(NOW);
    if (first.kind !== "created") throw new Error("expected a created purchase");
    await db.update(purchases).set({ confirmationUrl: "https://pay.example/1" }).where(eq(purchases.id, first.purchase.id));

    const second = await reserve(new Date(NOW.getTime() + 60_000), space.partnerId);

    expect(second.kind).toBe("reused");
    if (second.kind === "reused") expect(second.purchase.id).toBe(first.purchase.id);
  });

  test("is not available when more than 30 days are already paid ahead", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    expect((await reserve(NOW)).kind).toBe("created");
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });

    expect(await reserve(NOW)).toEqual({ kind: "not_available" });
  });

  test("is not available once the space is closed", async () => {
    await closeSpaceForUser(db, { userId: space.initiatorId, now: NOW, reason: "left" });

    expect(await reserve(NOW)).toEqual({ kind: "not_available" });
  });
});

describe("owner lists", () => {
  test("lists paid purchases that never got access", async () => {
    const granted = await paidPurchase(NOW);
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: granted, paidAt: NOW });
    const orphan = await paidPurchase(days(1));

    expect(await listPaidWithoutAccess(db)).toEqual([
      { purchaseId: orphan, spaceId: space.spaceId, userId: space.initiatorId, paidAt: days(1), amountKopecks: TOGETHER_PRICE_KOPECKS },
    ]);
  });

  test("lists closed spaces that still had paid time left", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    await closeSpaceForUser(db, { userId: space.partnerId, now: days(20), reason: "left" });

    expect(await listClosedWithRemaining(db)).toEqual([{ spaceId: space.spaceId, closedAt: days(20), closedReason: "left", remainingDays: 10 }]);
  });

  test("does not list a closed space whose paid time was used up", async () => {
    await grantAccessPeriod(db, { spaceId: space.spaceId, purchaseId: await paidPurchase(NOW), paidAt: NOW });
    await closeSpaceForUser(db, { userId: space.partnerId, now: days(31), reason: "left" });

    expect(await listClosedWithRemaining(db)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/together-billing.test.ts`
Expected: FAIL, `./together-billing` не существует.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/together-billing.ts`:

```ts
import { canRenew, nextPeriod, TOGETHER_PRODUCT, unusedPaidMs, type AccessPeriod } from "@grani/core";
import { and, asc, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { toPurchaseRecord, type PurchaseRecord } from "./purchases";
import { purchases, togetherAccessPeriods, togetherSpaces, type TogetherClosedReason } from "./schema";
import type { Database } from "./types";

const DAY_MS = 86_400_000;

export type GrantOutcome = { ok: true; created: boolean; period: AccessPeriod } | { ok: false; reason: "space_not_found" | "space_closed" };
export type ReserveOutcome = { kind: "reused" | "created"; purchase: PurchaseRecord } | { kind: "not_available" };
export type PaidWithoutAccess = { purchaseId: string; spaceId: string | null; userId: string; paidAt: Date | null; amountKopecks: number };
export type ClosedWithRemaining = { spaceId: string; closedAt: Date; closedReason: TogetherClosedReason | null; remainingDays: number };

type PeriodRow = typeof togetherAccessPeriods.$inferSelect;

const toPeriod = (row: Pick<PeriodRow, "startsAt" | "endsAt">): AccessPeriod => ({ startsAt: row.startsAt, endsAt: row.endsAt });

export async function listAccessPeriods(db: Database, spaceId: string): Promise<AccessPeriod[]> {
  const rows = await db.select().from(togetherAccessPeriods).where(eq(togetherAccessPeriods.spaceId, spaceId)).orderBy(asc(togetherAccessPeriods.startsAt));
  return rows.map(toPeriod);
}

export async function getAccessSnapshot(db: Database, spaceId: string): Promise<{ periods: AccessPeriod[]; closedAt: Date | null }> {
  const [space] = await db.select({ closedAt: togetherSpaces.closedAt }).from(togetherSpaces).where(eq(togetherSpaces.id, spaceId)).limit(1);
  return { periods: await listAccessPeriods(db, spaceId), closedAt: space?.closedAt ?? null };
}

export async function hasAccessPeriod(db: Database, purchaseId: string): Promise<boolean> {
  const [row] = await db.select({ id: togetherAccessPeriods.id }).from(togetherAccessPeriods).where(eq(togetherAccessPeriods.purchaseId, purchaseId)).limit(1);
  return row !== undefined;
}

// Единственное место, где появляется оплаченный интервал. Блокировка пространства выстраивает одновременные выдачи в очередь,
// уникальный purchase_id делает повтор безопасным
export async function grantAccessPeriod(db: Database, p: { spaceId: string; purchaseId: string; paidAt: Date }): Promise<GrantOutcome> {
  return db.transaction(async (tx): Promise<GrantOutcome> => {
    const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, p.spaceId)).for("update");
    if (!space) return { ok: false, reason: "space_not_found" };
    const [existing] = await tx.select().from(togetherAccessPeriods).where(eq(togetherAccessPeriods.purchaseId, p.purchaseId)).limit(1);
    if (existing) return { ok: true, created: false, period: toPeriod(existing) };
    if (space.status !== "active") return { ok: false, reason: "space_closed" };
    const period = nextPeriod(await listAccessPeriods(tx, p.spaceId), p.paidAt);
    await tx.insert(togetherAccessPeriods).values({ spaceId: p.spaceId, purchaseId: p.purchaseId, startsAt: period.startsAt, endsAt: period.endsAt });
    return { ok: true, created: true, period };
  });
}

// Проверка «можно ли платить», повторное использование открытой оплаты и создание покупки — под одной блокировкой пространства:
// два участника, нажавшие одновременно, получают одну покупку, а не две
export async function reserveSpacePurchase(
  db: Database,
  p: { spaceId: string; userId: string; amountKopecks: number; receiptEmail: string; now: Date; reuseSince: Date },
): Promise<ReserveOutcome> {
  return db.transaction(async (tx): Promise<ReserveOutcome> => {
    const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, p.spaceId)).for("update");
    if (!space || space.status !== "active") return { kind: "not_available" };
    if (!canRenew(await listAccessPeriods(tx, p.spaceId), p.now)) return { kind: "not_available" };
    const [open] = await tx
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.spaceId, p.spaceId),
          eq(purchases.product, TOGETHER_PRODUCT),
          eq(purchases.status, "pending"),
          isNotNull(purchases.confirmationUrl),
          gte(purchases.createdAt, p.reuseSince),
        ),
      )
      .orderBy(desc(purchases.createdAt))
      .limit(1);
    if (open) return { kind: "reused", purchase: toPurchaseRecord(open) };
    const [created] = await tx
      .insert(purchases)
      .values({ userId: p.userId, product: TOGETHER_PRODUCT, spaceId: p.spaceId, amountKopecks: p.amountKopecks, receiptEmail: p.receiptEmail })
      .returning();
    return { kind: "created", purchase: toPurchaseRecord(created!) };
  });
}

// Оплачено, но доступа нет (например, пространство закрылось до выдачи): владелец решает вручную, платёж не теряется молча
export async function listPaidWithoutAccess(db: Database): Promise<PaidWithoutAccess[]> {
  return db
    .select({ purchaseId: purchases.id, spaceId: purchases.spaceId, userId: purchases.userId, paidAt: purchases.paidAt, amountKopecks: purchases.amountKopecks })
    .from(purchases)
    .leftJoin(togetherAccessPeriods, eq(togetherAccessPeriods.purchaseId, purchases.id))
    .where(and(eq(purchases.product, TOGETHER_PRODUCT), eq(purchases.status, "succeeded"), isNull(togetherAccessPeriods.id)))
    .orderBy(asc(purchases.paidAt));
}

// Закрытые пространства с неиспользованным оплаченным сроком: остаток не возвращается автоматически, решение за владельцем
export async function listClosedWithRemaining(db: Database): Promise<ClosedWithRemaining[]> {
  const rows = await db
    .select({
      spaceId: togetherSpaces.id,
      closedAt: togetherSpaces.closedAt,
      closedReason: togetherSpaces.closedReason,
      startsAt: togetherAccessPeriods.startsAt,
      endsAt: togetherAccessPeriods.endsAt,
    })
    .from(togetherSpaces)
    .innerJoin(togetherAccessPeriods, eq(togetherAccessPeriods.spaceId, togetherSpaces.id))
    .where(eq(togetherSpaces.status, "closed"))
    .orderBy(asc(togetherSpaces.closedAt));
  const bySpace = new Map<string, { closedAt: Date; closedReason: TogetherClosedReason | null; periods: AccessPeriod[] }>();
  for (const row of rows) {
    if (!row.closedAt) continue;
    const entry = bySpace.get(row.spaceId) ?? { closedAt: row.closedAt, closedReason: row.closedReason, periods: [] };
    bySpace.set(row.spaceId, { ...entry, periods: [...entry.periods, toPeriod(row)] });
  }
  return [...bySpace.entries()]
    .map(([spaceId, entry]) => ({ spaceId, closedAt: entry.closedAt, closedReason: entry.closedReason, remainingMs: unusedPaidMs(entry.periods, entry.closedAt) }))
    .filter((entry) => entry.remainingMs > 0)
    .map(({ remainingMs, ...entry }) => ({ ...entry, remainingDays: Math.ceil(remainingMs / DAY_MS) }));
}
```

`packages/db/src/index.ts` — добавить строку `export * from "./together-billing";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): access period ledger, space purchase reservation and owner lists"
```

---

### Task 5: Сервис пространства в `apps/web`

**Files:**
- Create: `apps/web/src/server/together-service.ts`
- Create: `apps/web/src/server/together-service.test.ts`

**Interfaces:**
- Consumes: всё из `@grani/db` (Tasks 3–4), `accessState`, `canRenew`, `providedPaidSeconds`, `stageOf` из `@grani/core`.
- Produces:
  - `type TogetherDeps = { db: Database; now: () => Date; appUrl: string }`
  - `type TogetherSpaceView = { status: "pending" | "active"; myRole: TogetherRole; members: { role: TogetherRole; displayName: string }[]; pendingRequest: { displayName: string } | null; access: { active: boolean; accessUntil: string | null; stage: number; canRenew: boolean } }`
  - `createTogetherSpace(deps, p: { userId: string }): Promise<{ ok: true; spaceId: string; inviteUrl: string } | { ok: false; error: "already_in_space" }>`
  - `reissueTogetherInvite(deps, p: { userId: string }): Promise<{ ok: true; inviteUrl: string } | { ok: false; error: "not_found" | "not_pending" }>`
  - `peekTogetherInvite(deps, token: string): Promise<{ valid: boolean }>`
  - `requestTogetherJoin(deps, p: { token: string; userId: string }): Promise<RequestOutcome>`
  - `respondTogetherRequest(deps, p: { userId: string; accept: unknown }): Promise<RespondOutcome | { ok: false; error: "invalid" }>` (ошибки приводятся к полю `error`)
  - `leaveTogether(deps, p: { userId: string; acknowledged: unknown }): Promise<{ ok: true } | { ok: false; error: "acknowledgement_required" | "not_found" }>`
  - `getTogetherSpaceView(deps, userId: string): Promise<TogetherSpaceView | null>`

Единообразие: все сервисные результаты с ошибкой имеют форму `{ ok: false, error: <string> }` (как `startPurchase`); DB-слой возвращает `reason`, сервис переименовывает в `error`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/together-service.test.ts`:

```ts
import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { createTestDb, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createTogetherSpace,
  getTogetherSpaceView,
  leaveTogether,
  peekTogetherInvite,
  reissueTogetherInvite,
  requestTogetherJoin,
  respondTogetherRequest,
  type TogetherDeps,
} from "./together-service";

const APP_URL = "http://localhost:3000";
const START = new Date("2026-10-05T10:00:00Z");

let db: Database;
let clock: Date;
let deps: TogetherDeps;
let anna: string;
let boris: string;
let vera: string;

const tokenOf = (inviteUrl: string) => inviteUrl.split("/").at(-1)!;

async function create(userId = anna) {
  const outcome = await createTogetherSpace(deps, { userId });
  if (!outcome.ok) throw new Error(outcome.error);
  return { ...outcome, token: tokenOf(outcome.inviteUrl) };
}

async function makeActive() {
  const { token } = await create();
  await requestTogetherJoin(deps, { token, userId: boris });
  await respondTogetherRequest(deps, { userId: anna, accept: true });
  return token;
}

beforeEach(async () => {
  db = await createTestDb();
  clock = START;
  deps = { db, now: () => clock, appUrl: APP_URL };
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("createTogetherSpace", () => {
  test("returns an invite link on the site and refuses a second space", async () => {
    const { inviteUrl } = await create();

    expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/together\/invite\/[A-Za-z0-9_-]{24}$/);
    expect(await createTogetherSpace(deps, { userId: anna })).toEqual({ ok: false, error: "already_in_space" });
  });
});

describe("invite flow", () => {
  test("peek tells only whether the link can be used", async () => {
    const { token } = await create();

    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: true });
    expect(await peekTogetherInvite(deps, "nope")).toEqual({ valid: false });
    clock = new Date(START.getTime() + TOGETHER_INVITE_TTL_MS + 1);
    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: false });
  });

  test("the inviter sees who asked, confirms, and both then see an active space", async () => {
    const { token } = await create();
    expect(await requestTogetherJoin(deps, { token, userId: boris })).toEqual({ ok: true, status: "requested" });

    expect((await getTogetherSpaceView(deps, anna))?.pendingRequest).toEqual({ displayName: "Борис" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: true })).toEqual({ ok: true, status: "accepted" });

    for (const userId of [anna, boris]) {
      const view = await getTogetherSpaceView(deps, userId);
      expect(view).toMatchObject({ status: "active", pendingRequest: null, members: [{ role: "initiator", displayName: "Аня" }, { role: "partner", displayName: "Борис" }] });
    }
    expect((await getTogetherSpaceView(deps, anna))?.myRole).toBe("initiator");
    expect((await getTogetherSpaceView(deps, boris))?.myRole).toBe("partner");
  });

  test("the requester does not see the request details before confirmation", async () => {
    const { token } = await create();
    await requestTogetherJoin(deps, { token, userId: boris });

    expect(await getTogetherSpaceView(deps, boris)).toBeNull();
  });

  test("maps database refusals to errors and rejects a non-boolean answer", async () => {
    const { token } = await create();

    expect(await requestTogetherJoin(deps, { token, userId: anna })).toEqual({ ok: false, error: "own_invite" });
    expect(await requestTogetherJoin(deps, { token: "x".repeat(24), userId: boris })).toEqual({ ok: false, error: "invalid" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: "yes" })).toEqual({ ok: false, error: "invalid" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: true })).toEqual({ ok: false, error: "no_request" });
  });

  test("reissue gives a new link and the old one stops working", async () => {
    const { token } = await create();

    const outcome = await reissueTogetherInvite(deps, { userId: anna });

    expect(outcome.ok).toBe(true);
    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: false });
    expect(await reissueTogetherInvite(deps, { userId: vera })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("getTogetherSpaceView", () => {
  test("shows nothing to a person outside the space", async () => {
    await makeActive();

    expect(await getTogetherSpaceView(deps, vera)).toBeNull();
  });

  test("reports no access before the first payment and allows renewal", async () => {
    await makeActive();

    expect((await getTogetherSpaceView(deps, anna))?.access).toEqual({ active: false, accessUntil: null, stage: 0, canRenew: true });
  });
});

describe("leaveTogether", () => {
  test("requires the acknowledgement of the consequences", async () => {
    await makeActive();

    expect(await leaveTogether(deps, { userId: boris, acknowledged: false })).toEqual({ ok: false, error: "acknowledgement_required" });
    expect(await leaveTogether(deps, { userId: boris, acknowledged: "true" })).toEqual({ ok: false, error: "acknowledgement_required" });
    expect(await getTogetherSpaceView(deps, boris)).not.toBeNull();
  });

  test("closes the space for both without the partner's consent", async () => {
    await makeActive();

    expect(await leaveTogether(deps, { userId: boris, acknowledged: true })).toEqual({ ok: true });

    expect(await getTogetherSpaceView(deps, anna)).toBeNull();
    expect(await getTogetherSpaceView(deps, boris)).toBeNull();
    expect(await leaveTogether(deps, { userId: boris, acknowledged: true })).toEqual({ ok: false, error: "not_found" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/together-service.test.ts`
Expected: FAIL, `./together-service` не существует.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/together-service.ts`:

```ts
import { accessState, canRenew, providedPaidSeconds, stageOf } from "@grani/core";
import {
  closeSpaceForUser,
  createSpace,
  getAccessSnapshot,
  getActiveSpaceForUser,
  getPendingRequest,
  peekInvite,
  reissueInvite,
  requestJoin,
  respondToRequest,
  type Database,
  type TogetherRole,
} from "@grani/db";

export type TogetherDeps = { db: Database; now: () => Date; appUrl: string };
export type TogetherSpaceView = {
  status: "pending" | "active";
  myRole: TogetherRole;
  members: { role: TogetherRole; displayName: string }[];
  pendingRequest: { displayName: string } | null;
  access: { active: boolean; accessUntil: string | null; stage: number; canRenew: boolean };
};

const inviteUrl = (deps: TogetherDeps, token: string) => new URL(`/together/invite/${token}`, deps.appUrl).toString();

export async function createTogetherSpace(
  deps: TogetherDeps,
  p: { userId: string },
): Promise<{ ok: true; spaceId: string; inviteUrl: string } | { ok: false; error: "already_in_space" }> {
  const outcome = await createSpace(deps.db, { userId: p.userId, now: deps.now() });
  return outcome.ok ? { ok: true, spaceId: outcome.spaceId, inviteUrl: inviteUrl(deps, outcome.token) } : { ok: false, error: outcome.reason };
}

export async function reissueTogetherInvite(
  deps: TogetherDeps,
  p: { userId: string },
): Promise<{ ok: true; inviteUrl: string } | { ok: false; error: "not_found" | "not_pending" }> {
  const outcome = await reissueInvite(deps.db, { userId: p.userId, now: deps.now() });
  return outcome.ok ? { ok: true, inviteUrl: inviteUrl(deps, outcome.token) } : { ok: false, error: outcome.reason };
}

export async function peekTogetherInvite(deps: TogetherDeps, token: string): Promise<{ valid: boolean }> {
  return { valid: await peekInvite(deps.db, token, deps.now()) };
}

export async function requestTogetherJoin(
  deps: TogetherDeps,
  p: { token: string; userId: string },
): Promise<{ ok: true; status: "requested" } | { ok: false; error: "invalid" | "own_invite" | "already_in_space" }> {
  const outcome = await requestJoin(deps.db, { token: p.token, userId: p.userId, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function respondTogetherRequest(
  deps: TogetherDeps,
  p: { userId: string; accept: unknown },
): Promise<{ ok: true; status: "accepted" | "declined" } | { ok: false; error: "invalid" | "not_found" | "no_request" | "requester_unavailable" }> {
  if (typeof p.accept !== "boolean") return { ok: false, error: "invalid" };
  const outcome = await respondToRequest(deps.db, { userId: p.userId, accept: p.accept, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

// Выход без согласия партнёра, но только после того, как человек увидел последствия: клиент присылает acknowledged: true
export async function leaveTogether(
  deps: TogetherDeps,
  p: { userId: string; acknowledged: unknown },
): Promise<{ ok: true } | { ok: false; error: "acknowledgement_required" | "not_found" }> {
  if (p.acknowledged !== true) return { ok: false, error: "acknowledgement_required" };
  const outcome = await closeSpaceForUser(deps.db, { userId: p.userId, now: deps.now(), reason: "left" });
  return outcome.ok ? { ok: true } : { ok: false, error: outcome.reason };
}

export async function getTogetherSpaceView(deps: TogetherDeps, userId: string): Promise<TogetherSpaceView | null> {
  const snapshot = await getActiveSpaceForUser(deps.db, userId);
  const me = snapshot?.members.find((member) => member.userId === userId);
  if (!snapshot || !me || snapshot.space.status === "closed") return null;
  const now = deps.now();
  const { periods, closedAt } = await getAccessSnapshot(deps.db, snapshot.space.id);
  const state = accessState(periods, now, closedAt);
  // Запрос на вступление виден только инициатору; имя запросившего — единственное, что ему раскрывается до подтверждения
  const request = me.role === "initiator" ? await getPendingRequest(deps.db, { userId, now }) : null;
  return {
    status: snapshot.space.status,
    myRole: me.role,
    members: snapshot.members.map((member) => ({ role: member.role, displayName: member.displayName })),
    pendingRequest: request ? { displayName: request.displayName } : null,
    access: {
      active: state.active,
      accessUntil: state.accessUntil ? state.accessUntil.toISOString() : null,
      stage: stageOf(providedPaidSeconds(periods, now, closedAt)),
      canRenew: canRenew(periods, now, closedAt),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/server/together-service.test.ts && pnpm typecheck`
Expected: PASS. Если `outcome.ok ? outcome : { ... }` не проходит как совместимая форма, вернуть явные объекты `{ ok: true, status: outcome.status }`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/together-service.ts apps/web/src/server/together-service.test.ts
git commit -m "feat(web): together space service and view"
```

---

### Task 6: Оплата «Вдвоём» и выдача доступа

**Files:**
- Create: `apps/web/src/server/together-payments.ts`
- Create: `apps/web/src/server/together-payments.test.ts`
- Modify: `apps/web/src/server/payments-service.ts`
- Modify: `apps/web/src/server/payments-service.test.ts`

**Interfaces:**
- Consumes: `PaymentsDeps`, `normalizeReceiptEmail`, `syncPayment` (`./payments-service`), `PaymentGateway`; `getActiveSpaceForUser`, `reserveSpacePurchase`, `grantAccessPeriod`, `hasAccessPeriod`, `attachPayment`, `markPurchaseCanceled`, `setReceiptEmail`, `getPurchase` (`@grani/db`); `TOGETHER_PRICE_KOPECKS`, `isTogetherProduct` (`@grani/core`).
- Produces:
  - `TOGETHER_DESCRIPTION: string`
  - `startTogetherPurchase(deps: PaymentsDeps, p: { userId: string; email: unknown }): Promise<{ ok: true; url: string; purchaseId: string } | { ok: false; error: "invalid_email" | "not_found" | "not_available" | "payment_failed" }>`
  - `healTogetherAccess(deps: PaymentsDeps, purchaseId: string): Promise<GrantOutcome | null>`
  - `getTogetherPurchaseStatus(deps: PaymentsDeps, p: { purchaseId: string; userId: string }): Promise<{ id: string; status: PurchaseStatus; granted: boolean } | null>`
  - `syncPayment` для `together_30d` выдаёт период; поведение старых продуктов не меняется.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/together-payments.test.ts`:

```ts
import { TOGETHER_PRICE_KOPECKS } from "@grani/core";
import {
  closeSpaceForUser,
  createSpace,
  createTestDb,
  getAccessSnapshot,
  getPurchase,
  hasAccessPeriod,
  listAccessPeriods,
  listPaidWithoutAccess,
  markPurchaseSucceeded,
  seedTogetherSpace,
  seedUser,
  type Database,
} from "@grani/db/testing";
import type { GenerateJob } from "@grani/core";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { GatewayPayment } from "./payments/gateway";
import { startPurchase, syncPayment, type PaymentsDeps } from "./payments-service";
import { getTogetherPurchaseStatus, healTogetherAccess, startTogetherPurchase, TOGETHER_DESCRIPTION } from "./together-payments";

const APP_URL = "http://localhost:3000";
const START = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;
const EMAIL = "anna@example.ru";

let db: Database;
let store: Map<string, GatewayPayment>;
let gateway: FakeGateway;
let clock: Date;
let deps: PaymentsDeps;
let enqueue: Mock<(job: GenerateJob) => Promise<void>>;
let space: { spaceId: string; initiatorId: string; partnerId: string };

const paymentOf = (url: string) => url.split("/dev/pay/")[1]!;

async function start(userId = space.initiatorId, email: unknown = EMAIL) {
  const outcome = await startTogetherPurchase(deps, { userId, email });
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome;
}

async function buyAndPay(userId = space.initiatorId) {
  const outcome = await start(userId);
  gateway.complete(paymentOf(outcome.url), "succeeded");
  await syncPayment(deps, paymentOf(outcome.url));
  return outcome;
}

beforeEach(async () => {
  db = await createTestDb();
  store = new Map();
  gateway = createFakeGateway({ appUrl: APP_URL, store });
  clock = START;
  enqueue = vi.fn<(job: GenerateJob) => Promise<void>>().mockResolvedValue(undefined);
  deps = { db, gateway, appUrl: APP_URL, now: () => clock, enqueueGenerate: enqueue };
  space = await seedTogetherSpace(db);
});

describe("startTogetherPurchase", () => {
  test("creates a payment for the server price with the receipt description", async () => {
    const outcome = await start();

    const payment = store.get(paymentOf(outcome.url))!;
    expect(payment.amountKopecks).toBe(TOGETHER_PRICE_KOPECKS);
    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "pending", spaceId: space.spaceId, product: "together_30d", yookassaPaymentId: payment.id });
    expect(TOGETHER_DESCRIPTION).toBe("Доступ к «Грани. Вдвоём» на 30 дней для двоих");
  });

  test("returns the payment page of a recent unfinished purchase, for either member", async () => {
    const first = await start(space.initiatorId);
    const second = await start(space.partnerId);

    expect(second.url).toBe(first.url);
    expect(second.purchaseId).toBe(first.purchaseId);
    expect(store.size).toBe(1);
  });

  test("needs a valid receipt email, a space of the user, and an active space", async () => {
    const outsider = await seedUser(db, { externalId: "outsider" });

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: "not-an-email" })).toEqual({ ok: false, error: "invalid_email" });
    expect(await startTogetherPurchase(deps, { userId: outsider, email: EMAIL })).toEqual({ ok: false, error: "not_found" });
  });

  test("is not available while the partner has not joined", async () => {
    const lonely = await seedUser(db, { externalId: "lonely" });
    await createSpace(db, { userId: lonely, now: START });

    expect(await startTogetherPurchase(deps, { userId: lonely, email: EMAIL })).toEqual({ ok: false, error: "not_available" });
  });

  test("allows one period ahead and refuses the next", async () => {
    await buyAndPay();
    await buyAndPay(space.partnerId);

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: EMAIL })).toEqual({ ok: false, error: "not_available" });
  });

  test("a payment that the gateway cannot create is canceled and reported", async () => {
    vi.spyOn(gateway, "createPayment").mockRejectedValueOnce(new Error("gateway down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await startTogetherPurchase(deps, { userId: space.initiatorId, email: EMAIL })).toEqual({ ok: false, error: "payment_failed" });
  });
});

describe("granting access", () => {
  test("one succeeded payment gives exactly one 30-day period, however often it is reported", async () => {
    const outcome = await buyAndPay();
    await syncPayment(deps, paymentOf(outcome.url));
    await syncPayment(deps, paymentOf(outcome.url));

    expect(await listAccessPeriods(db, space.spaceId)).toEqual([{ startsAt: START, endsAt: new Date(START.getTime() + 30 * DAY_MS) }]);
    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "succeeded", paidAt: START });
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("an early payment starts when the current period ends", async () => {
    await buyAndPay();
    clock = new Date(START.getTime() + 10 * DAY_MS);

    await buyAndPay(space.partnerId);

    const periods = await listAccessPeriods(db, space.spaceId);
    expect(periods[1]).toEqual({ startsAt: new Date(START.getTime() + 30 * DAY_MS), endsAt: new Date(START.getTime() + 60 * DAY_MS) });
  });

  test("a payment with a different amount opens nothing", async () => {
    const outcome = await start();
    const id = paymentOf(outcome.url);
    store.set(id, { ...store.get(id)!, status: "succeeded", paid: true, amountKopecks: 100 });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncPayment(deps, id);

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "pending" });
    expect(await listAccessPeriods(db, space.spaceId)).toEqual([]);
  });

  test("a canceled payment opens nothing", async () => {
    const outcome = await start();
    gateway.complete(paymentOf(outcome.url), "canceled");

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "canceled" });
    expect(await listAccessPeriods(db, space.spaceId)).toEqual([]);
  });

  test("a payment that succeeds after the space was closed gives no access and is listed for the owner", async () => {
    const outcome = await start();
    await closeSpaceForUser(db, { userId: space.partnerId, now: clock, reason: "left" });
    gateway.complete(paymentOf(outcome.url), "succeeded");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await getPurchase(db, outcome.purchaseId)).toMatchObject({ status: "succeeded" });
    expect(await hasAccessPeriod(db, outcome.purchaseId)).toBe(false);
    expect(await listPaidWithoutAccess(db)).toMatchObject([{ purchaseId: outcome.purchaseId, spaceId: space.spaceId }]);
    expect((await getAccessSnapshot(db, space.spaceId)).periods).toEqual([]);
  });

  test("a crash between the succeeded status and the grant is healed by the next report", async () => {
    const outcome = await start();
    gateway.complete(paymentOf(outcome.url), "succeeded");
    await markPurchaseSucceeded(db, outcome.purchaseId, START);
    expect(await hasAccessPeriod(db, outcome.purchaseId)).toBe(false);

    await syncPayment(deps, paymentOf(outcome.url));

    expect(await listAccessPeriods(db, space.spaceId)).toHaveLength(1);
    expect(await healTogetherAccess(deps, outcome.purchaseId)).toMatchObject({ ok: true, created: false });
  });
});

describe("getTogetherPurchaseStatus", () => {
  test("both members and the payer see the status; polling confirms a paid purchase", async () => {
    const outcome = await start(space.initiatorId);
    gateway.complete(paymentOf(outcome.url), "succeeded");

    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: space.partnerId })).toEqual({
      id: outcome.purchaseId,
      status: "succeeded",
      granted: true,
    });
    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: space.initiatorId })).toMatchObject({ status: "succeeded", granted: true });
  });

  test("an outsider and a malformed id get nothing", async () => {
    const outcome = await start();
    const outsider = await seedUser(db, { externalId: "outsider" });

    expect(await getTogetherPurchaseStatus(deps, { purchaseId: outcome.purchaseId, userId: outsider })).toBeNull();
    expect(await getTogetherPurchaseStatus(deps, { purchaseId: "nope", userId: space.initiatorId })).toBeNull();
  });
});

describe("old purchase entry points", () => {
  test("the report purchase endpoint refuses the together product", async () => {
    const result = await startPurchase(deps, { userId: space.initiatorId, product: "together_30d", targetId: space.spaceId, email: EMAIL });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});
```

Дополнить `apps/web/src/server/payments-service.test.ts` (внутри `describe("getPurchaseView", ...)` или в новом `describe` в конце файла; импортировать `seedTogetherSpace` из `@grani/db/testing`, `createPurchase` из `@grani/db/testing`):

```ts
describe("together purchases are invisible to report views", () => {
  test("getPurchaseView returns nothing for a together purchase", async () => {
    const space = await seedTogetherSpace(db);
    const purchase = await createPurchase(db, {
      userId: space.initiatorId,
      product: "together_30d",
      target: { spaceId: space.spaceId },
      amountKopecks: 59_900,
    });

    expect(await getPurchaseView(deps, { purchaseId: purchase.id, userId: space.initiatorId })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/together-payments.test.ts apps/web/src/server/payments-service.test.ts`
Expected: FAIL, `./together-payments` не существует.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/together-payments.ts`:

```ts
import { isTogetherProduct, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import {
  attachPayment,
  getActiveSpaceForUser,
  getPurchase,
  grantAccessPeriod,
  hasAccessPeriod,
  markPurchaseCanceled,
  reserveSpacePurchase,
  setReceiptEmail,
  type GrantOutcome,
  type PurchaseStatus,
} from "@grani/db";
import { normalizeReceiptEmail, syncPayment, type PaymentsDeps } from "./payments-service";

// Попадает в чек «Мой налог» — название услуги
export const TOGETHER_DESCRIPTION = "Доступ к «Грани. Вдвоём» на 30 дней для двоих";

const REUSE_WINDOW_MS = 30 * 60_000;

export type StartTogetherOutcome =
  | { ok: true; url: string; purchaseId: string }
  | { ok: false; error: "invalid_email" | "not_found" | "not_available" | "payment_failed" };

export async function startTogetherPurchase(deps: PaymentsDeps, p: { userId: string; email: unknown }): Promise<StartTogetherOutcome> {
  const email = normalizeReceiptEmail(p.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const snapshot = await getActiveSpaceForUser(deps.db, p.userId);
  if (!snapshot) return { ok: false, error: "not_found" };

  const now = deps.now();
  const reserved = await reserveSpacePurchase(deps.db, {
    spaceId: snapshot.space.id,
    userId: p.userId,
    amountKopecks: TOGETHER_PRICE_KOPECKS,
    receiptEmail: email,
    now,
    reuseSince: new Date(now.getTime() - REUSE_WINDOW_MS),
  });
  if (reserved.kind === "not_available") return { ok: false, error: "not_available" };
  const { purchase } = reserved;
  if (reserved.kind === "reused" && purchase.confirmationUrl) {
    if (purchase.receiptEmail !== email) await setReceiptEmail(deps.db, purchase.id, email);
    return { ok: true, url: purchase.confirmationUrl, purchaseId: purchase.id };
  }
  return createGatewayPayment(deps, purchase.id, purchase.amountKopecks);
}

async function createGatewayPayment(deps: PaymentsDeps, purchaseId: string, amountKopecks: number): Promise<StartTogetherOutcome> {
  try {
    const payment = await deps.gateway.createPayment({
      purchaseId,
      amountKopecks,
      description: TOGETHER_DESCRIPTION,
      returnUrl: new URL(`/together?purchase=${purchaseId}`, deps.appUrl).toString(),
    });
    if (!payment.confirmationUrl) throw new Error("payment has no confirmation url");
    await attachPayment(deps.db, purchaseId, { paymentId: payment.id, confirmationUrl: payment.confirmationUrl });
    return { ok: true, url: payment.confirmationUrl, purchaseId };
  } catch (error) {
    console.error("together payment was not created", { purchaseId, error: String(error) });
    await markPurchaseCanceled(deps.db, purchaseId);
    return { ok: false, error: "payment_failed" };
  }
}

// Выдаёт период по уже подтверждённой покупке. Безопасно вызывать сколько угодно раз: уникальный purchase_id не даст второго периода
export async function healTogetherAccess(deps: PaymentsDeps, purchaseId: string): Promise<GrantOutcome | null> {
  const purchase = await getPurchase(deps.db, purchaseId);
  if (!purchase || !isTogetherProduct(purchase.product) || purchase.status !== "succeeded" || !purchase.spaceId) return null;
  return grantAccessPeriod(deps.db, { spaceId: purchase.spaceId, purchaseId: purchase.id, paidAt: purchase.paidAt ?? deps.now() });
}

export async function getTogetherPurchaseStatus(
  deps: PaymentsDeps,
  p: { purchaseId: string; userId: string },
): Promise<{ id: string; status: PurchaseStatus; granted: boolean } | null> {
  let purchase = await getPurchase(deps.db, p.purchaseId);
  if (!purchase || !isTogetherProduct(purchase.product)) return null;
  // Покупку видят плательщик и действующие участники пространства; чужим она не существует
  const snapshot = await getActiveSpaceForUser(deps.db, p.userId);
  const isMember = snapshot !== null && snapshot.space.id === purchase.spaceId;
  if (purchase.userId !== p.userId && !isMember) return null;

  if (purchase.status === "pending" && purchase.yookassaPaymentId) purchase = (await syncPayment(deps, purchase.yookassaPaymentId)) ?? purchase;
  if (purchase.status === "succeeded") await healTogetherAccess(deps, purchase.id);
  return { id: purchase.id, status: purchase.status, granted: await hasAccessPeriod(deps.db, purchase.id) };
}
```

Изменить `apps/web/src/server/payments-service.ts`:

1. Импорты: добавить `isTogetherProduct` из `@grani/core`; `import { healTogetherAccess } from "./together-payments";` (циклический импорт безопасен: `together-payments` берёт из `payments-service` только функции, вызываемые в рантайме после загрузки модулей, а тип `PaymentsDeps` стирается).
2. Добавить функцию:

```ts
async function fulfillPaid(deps: PaymentsDeps, purchase: PurchaseRecord): Promise<void> {
  if (!isTogetherProduct(purchase.product)) return enqueuePaid(deps, purchase);
  const outcome = await healTogetherAccess(deps, purchase.id);
  // Деньги приняты, а доступ выдать нельзя (пространство закрыто): покупка попадёт в список владельца
  if (outcome && !outcome.ok) console.warn("paid together access was not granted", { purchaseId: purchase.id, reason: outcome.reason });
}
```
3. В `syncPayment` заменить блок для не-pending и для успешной оплаты:

```ts
  if (purchase.status !== "pending") {
    // Выдача периода могла оборваться между статусом и записью: догоняем при повторном уведомлении
    if (purchase.status === "succeeded" && isTogetherProduct(purchase.product)) await healTogetherAccess(deps, purchase.id);
    return purchase;
  }
```
и
```ts
    if (await markPurchaseSucceeded(deps.db, purchase.id, deps.now())) await fulfillPaid(deps, purchase);
```
(вместо прежнего `await enqueuePaid(deps, purchase)`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/server && pnpm typecheck`
Expected: PASS, в том числе прежние тесты `payments-service.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server
git commit -m "feat(web): together payments and idempotent access grant"
```

---

### Task 7: HTTP-маршруты, общая проверка, владелец, фейковая оплата

**Files:**
- Create: `apps/web/src/server/together-route.ts`
- Create: `apps/web/src/server/together-route.test.ts`
- Modify: `apps/web/src/server/rate-limit.ts`
- Modify: `apps/web/src/server/owner.ts`
- Create: `apps/web/src/app/api/together/spaces/route.ts`
- Create: `apps/web/src/app/api/together/invite/route.ts`
- Create: `apps/web/src/app/api/together/invite/[token]/route.ts`
- Create: `apps/web/src/app/api/together/invite/request/route.ts`
- Create: `apps/web/src/app/api/together/invite/confirm/route.ts`
- Create: `apps/web/src/app/api/together/leave/route.ts`
- Create: `apps/web/src/app/api/together/space/route.ts`
- Create: `apps/web/src/app/api/together/purchases/route.ts`
- Create: `apps/web/src/app/api/together/purchases/[id]/route.ts`
- Create: `apps/web/src/app/api/admin/together/route.ts`
- Modify: `apps/web/src/app/api/dev/pay/[id]/route.ts`

**Interfaces:**
- Consumes: сервисы Tasks 5–6, `loginDeps`, `getCurrentUser`, `isSameOrigin`, `SESSION_COOKIE`, `clientKeyFromHeaders`, `paymentsDeps`, `listPaidWithoutAccess`, `listClosedWithRemaining`, `hasIdentity`.
- Produces:
  - `authorizeTogether(request: NextRequest, options: { mutating: boolean; limiter?: RateLimiter }): Promise<{ user: UserRecord; deps: TogetherDeps } | NextResponse>`
  - `failure(error: string, status: number): NextResponse`, `readJsonObject(request: NextRequest): Promise<Record<string, unknown>>`
  - `togetherLimiter` (`rate-limit.ts`), `isOwnerUser(user: UserRecord): Promise<boolean>` (`owner.ts`)
  - HTTP-контракт: см. раздел «API» спецификации; коды: `invalid`→404, `own_invite`/`already_in_space`/`not_pending`/`no_request`→409, `acknowledgement_required`/`invalid_email`→400, `not_found`→404, `not_available`→409, `payment_failed`→502, `requester_unavailable`→409.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/together-route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("./login-service", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("./deps", () => ({
  loginDeps: () => ({ db: {}, env: { APP_URL: "http://localhost:3000" }, now: () => new Date("2026-10-05T10:00:00Z") }),
}));

import { createRateLimiter } from "./rate-limit";
import { authorizeTogether, failure, readJsonObject } from "./together-route";

const request = (init: { method?: string; origin?: string; cookie?: string; body?: string } = {}) =>
  new NextRequest("http://localhost:3000/api/together/x", {
    method: init.method ?? "POST",
    headers: { ...(init.origin ? { origin: init.origin } : {}), ...(init.cookie ? { cookie: init.cookie } : {}), "x-forwarded-for": "1.2.3.4" },
    body: init.body,
  });

beforeEach(() => getCurrentUser.mockReset());

describe("authorizeTogether", () => {
  test("rejects a mutating request from another origin before touching the session", async () => {
    const result = await authorizeTogether(request({ origin: "https://evil.example" }), { mutating: true });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("rejects a request without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true });

    expect((result as Response).status).toBe(401);
  });

  test("returns the user and deps for a valid same-origin request", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });

    const result = await authorizeTogether(request({ origin: "http://localhost:3000", cookie: "grani_session=abc" }), { mutating: true });

    expect(result).toMatchObject({ user: { id: "u1" }, deps: { appUrl: "http://localhost:3000" } });
    expect(getCurrentUser).toHaveBeenCalledWith(expect.anything(), "abc");
  });

  test("does not check the origin of a read-only request", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });

    const result = await authorizeTogether(request({ method: "GET" }), { mutating: false });

    expect(result).toMatchObject({ user: { id: "u1" } });
  });

  test("answers 429 when the limiter is exhausted", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    getCurrentUser.mockResolvedValue({ id: "u1", displayName: "Аня", gender: null });
    await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true, limiter });

    const result = await authorizeTogether(request({ origin: "http://localhost:3000" }), { mutating: true, limiter });

    expect((result as Response).status).toBe(429);
  });
});

describe("failure and readJsonObject", () => {
  test("failure builds the error envelope", async () => {
    const response = failure("not_found", 404);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
  });

  test("readJsonObject returns an empty object for a bad or non-object body", async () => {
    expect(await readJsonObject(request({ body: "{\"a\":1}" }))).toEqual({ a: 1 });
    expect(await readJsonObject(request({ body: "not json" }))).toEqual({});
    expect(await readJsonObject(request({ body: "[1,2]" }))).toEqual({});
    expect(await readJsonObject(request({ body: "null" }))).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/together-route.test.ts`
Expected: FAIL, `./together-route` не существует.

- [ ] **Step 3: Write minimal implementation**

3a. `apps/web/src/server/rate-limit.ts` — добавить в конец:

```ts
const TOGETHER_PER_MINUTE = 30;

export const togetherLimiter = createRateLimiter({ limit: TOGETHER_PER_MINUTE, windowMs: MINUTE_MS });
```

3b. `apps/web/src/server/owner.ts` — выделить проверку владелицы:

```ts
import { hasIdentity, type UserRecord } from "@grani/db";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { getEnv } from "./env";
import { currentUser } from "./viewer";

export async function isOwnerUser(user: UserRecord): Promise<boolean> {
  const owner = getEnv().owner;
  return owner !== null && (await hasIdentity(getDb(), user.id, owner));
}

// Служебные страницы видит только владелица (OWNER_IDENTITY); остальным — обычная 404, без намёка, что страница есть
export async function requireOwner(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user || !(await isOwnerUser(user))) notFound();
  return user;
}
```

3c. Create `apps/web/src/server/together-route.ts`:

```ts
import type { UserRecord } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "./deps";
import { isSameOrigin, SESSION_COOKIE } from "./http";
import { getCurrentUser } from "./login-service";
import { clientKeyFromHeaders, type RateLimiter } from "./rate-limit";
import type { TogetherDeps } from "./together-service";

export type TogetherContext = { user: UserRecord; deps: TogetherDeps };

export const failure = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Общая проверка маршрутов «Вдвоём»: источник запроса для изменяющих, лимит, сессия. Права на данные проверяет сервис по userId
export async function authorizeTogether(request: NextRequest, options: { mutating: boolean; limiter?: RateLimiter }): Promise<TogetherContext | NextResponse> {
  const login = loginDeps();
  if (options.mutating && !isSameOrigin(request, login.env.APP_URL)) return failure("bad_origin", 403);
  if (options.limiter && !options.limiter.allow(clientKeyFromHeaders(request.headers))) return failure("rate_limited", 429);
  const user = await getCurrentUser(login, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return failure("unauthorized", 401);
  return { user, deps: { db: login.db, now: login.now, appUrl: login.env.APP_URL } };
}

export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
```

3d. Маршруты (все `POST` изменяющие: `mutating: true`, `limiter: togetherLimiter`). Единый шаблон; ниже файлы целиком.

`apps/web/src/app/api/together/spaces/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createTogetherSpace } from "@/server/together-service";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure } from "@/server/together-route";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const outcome = await createTogetherSpace(context.deps, { userId: context.user.id });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, 409);
}
```

`apps/web/src/app/api/together/invite/route.ts` (перевыпуск):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure } from "@/server/together-route";
import { reissueTogetherInvite } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const outcome = await reissueTogetherInvite(context.deps, { userId: context.user.id });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "not_found" ? 404 : 409);
}
```

`apps/web/src/app/api/together/invite/[token]/route.ts` (публичный просмотр, без сессии):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { clientKeyFromHeaders, togetherLimiter } from "@/server/rate-limit";
import { failure } from "@/server/together-route";
import { peekTogetherInvite } from "@/server/together-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!togetherLimiter.allow(clientKeyFromHeaders(request.headers))) return failure("rate_limited", 429);
  const login = loginDeps();
  const { token } = await params;
  const outcome = await peekTogetherInvite({ db: login.db, now: login.now, appUrl: login.env.APP_URL }, token);
  return NextResponse.json({ ok: true, ...outcome }, { headers: { "cache-control": "no-store" } });
}
```

`apps/web/src/app/api/together/invite/request/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { requestTogetherJoin } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { token } = await readJsonObject(request);
  const outcome = await requestTogetherJoin(context.deps, { token: typeof token === "string" ? token : "", userId: context.user.id });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "invalid" ? 404 : 409);
}
```

`apps/web/src/app/api/together/invite/confirm/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { respondTogetherRequest } from "@/server/together-service";

const STATUS = { invalid: 400, not_found: 404, no_request: 409, requester_unavailable: 409 } as const;

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { accept } = await readJsonObject(request);
  const outcome = await respondTogetherRequest(context.deps, { userId: context.user.id, accept });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, STATUS[outcome.error]);
}
```

`apps/web/src/app/api/together/leave/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { togetherLimiter } from "@/server/rate-limit";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";
import { leaveTogether } from "@/server/together-service";

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: togetherLimiter });
  if (context instanceof NextResponse) return context;
  const { acknowledged } = await readJsonObject(request);
  const outcome = await leaveTogether(context.deps, { userId: context.user.id, acknowledged });
  if (outcome.ok) return NextResponse.json(outcome);
  return failure(outcome.error, outcome.error === "not_found" ? 404 : 400);
}
```

`apps/web/src/app/api/together/space/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { authorizeTogether } from "@/server/together-route";
import { getTogetherSpaceView } from "@/server/together-service";

export async function GET(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const space = await getTogetherSpaceView(context.deps, context.user.id);
  return NextResponse.json({ ok: true, space }, { headers: { "cache-control": "no-store" } });
}
```

`apps/web/src/app/api/together/purchases/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { paymentsDeps } from "@/server/payments-deps";
import { purchasesLimiter } from "@/server/rate-limit";
import { startTogetherPurchase, type StartTogetherOutcome } from "@/server/together-payments";
import { authorizeTogether, failure, readJsonObject } from "@/server/together-route";

const STATUS: Record<Extract<StartTogetherOutcome, { ok: false }>["error"], number> = {
  invalid_email: 400,
  not_found: 404,
  not_available: 409,
  payment_failed: 502,
};

export async function POST(request: NextRequest) {
  const context = await authorizeTogether(request, { mutating: true, limiter: purchasesLimiter });
  if (context instanceof NextResponse) return context;
  const deps = paymentsDeps();
  if (!deps) return failure("payments_unavailable", 503);
  const { email } = await readJsonObject(request);
  const outcome = await startTogetherPurchase(deps, { userId: context.user.id, email });
  return outcome.ok ? NextResponse.json(outcome) : failure(outcome.error, STATUS[outcome.error]);
}
```

`apps/web/src/app/api/together/purchases/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { paymentsDeps } from "@/server/payments-deps";
import { getTogetherPurchaseStatus } from "@/server/together-payments";
import { authorizeTogether, failure } from "@/server/together-route";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await authorizeTogether(request, { mutating: false });
  if (context instanceof NextResponse) return context;
  const deps = paymentsDeps();
  const { id } = await params;
  const view = deps ? await getTogetherPurchaseStatus(deps, { purchaseId: id, userId: context.user.id }) : null;
  if (!view) return failure("not_found", 404);
  return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
}
```

`apps/web/src/app/api/admin/together/route.ts` (владелица; чужим — пустая 404):

```ts
import { listClosedWithRemaining, listPaidWithoutAccess } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { loginDeps } from "@/server/deps";
import { SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { isOwnerUser } from "@/server/owner";

// Что требует ручного решения владелицы: оплачено без доступа и закрытые пространства с остатком оплаченного срока
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(loginDeps(), request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user || !(await isOwnerUser(user))) return new NextResponse(null, { status: 404 });
  const db = getDb();
  const [paidWithoutAccess, closedWithRemaining] = await Promise.all([listPaidWithoutAccess(db), listClosedWithRemaining(db)]);
  return NextResponse.json({ ok: true, paidWithoutAccess, closedWithRemaining }, { headers: { "cache-control": "no-store" } });
}
```

3e. `apps/web/src/app/api/dev/pay/[id]/route.ts` — возврат с фейковой оплаты для `together_30d` ведёт на `/together`:

```ts
import { isTogetherProduct } from "@grani/core";
import { getPurchase } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isSameOrigin } from "@/server/http";
import { fakeGateway, paymentsDeps } from "@/server/payments-deps";
import { syncPayment } from "@/server/payments-service";

// Только локально и в сквозных тестах: заменяет страницу оплаты ЮKassa
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gateway = fakeGateway();
  const deps = paymentsDeps();
  if (!gateway || !deps) return new NextResponse(null, { status: 404 });
  if (!isSameOrigin(request, getEnv().APP_URL)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const outcome = form.get("outcome") === "succeeded" ? "succeeded" : "canceled";
  const payment = await gateway.getPayment(id);
  if (!payment || !gateway.complete(id, outcome)) return new NextResponse(null, { status: 404 });
  await syncPayment(deps, id);
  const purchase = payment.purchaseId ? await getPurchase(deps.db, payment.purchaseId) : null;
  const target = purchase && isTogetherProduct(purchase.product) ? `/together?purchase=${purchase.id}` : `/purchases/${payment.purchaseId}`;
  return NextResponse.redirect(new URL(target, getEnv().APP_URL), 303);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web && pnpm typecheck`
Expected: PASS. `pnpm typecheck` проверяет и сигнатуры route handlers (формы `params` как в существующих маршрутах).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): together API routes with shared guard and owner list"
```

---

### Task 8: Сквозной сценарий, документы, полная проверка

**Files:**
- Create: `e2e/together.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-05-together-backend-design.md` (выровнять с реализацией)
- Modify: `docs/together/adr/ADR-001-together-space.md`
- Modify: `docs/together/CLAUDE_HANDOFF.md` (запись этапа 0)

**Interfaces:**
- Consumes: HTTP-контракт Task 7, фейковый шлюз (`PAYMENTS_FAKE=1`), dev-вход (`DEV_LOGIN=1`) из `apps/web/.env.development.local`.
- Produces: проверенный e2e-сценарий и обновлённые документы для Codex.

- [ ] **Step 1: Write the failing test**

Create `e2e/together.spec.ts`:

```ts
import { expect, test, type Browser, type Page } from "@playwright/test";
import { BASE_URL, uniqueName } from "./helpers";

const EMAIL = "anna@example.ru";
const origin = { origin: BASE_URL };

// Пользователь без результата теста: «Вдвоём» его не требует
async function signedIn(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

const post = (page: Page, url: string, data?: unknown) => page.request.post(url, { data, headers: origin });

test("two accounts without tests build a space, pay once, and leave", async ({ browser }) => {
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  const vera = await signedIn(browser, uniqueName("Вера"));

  const created = await post(anna, "/api/together/spaces");
  expect(created.status()).toBe(200);
  const { inviteUrl, spaceId } = (await created.json()) as { inviteUrl: string; spaceId: string };
  const token = inviteUrl.split("/").at(-1)!;
  expect((await post(anna, "/api/together/spaces")).status()).toBe(409);

  // Ссылку можно проверить без входа, но она ничего не раскрывает
  const peek = await anna.request.get(`/api/together/invite/${token}`);
  expect(await peek.json()).toEqual({ ok: true, valid: true });
  expect((await (await anna.request.get("/api/together/invite/not-a-real-token")).json()).valid).toBe(false);

  // Инициатор не может принять собственную ссылку, а запрос Бориса не открывает ему пространство
  expect((await post(anna, "/api/together/invite/request", { token })).status()).toBe(409);
  expect((await post(boris, "/api/together/invite/request", { token })).status()).toBe(200);
  expect(((await (await boris.request.get("/api/together/space")).json()) as { space: unknown }).space).toBeNull();
  // Третий человек получает нейтральный отказ, пока запрос Бориса ждёт
  expect((await post(vera, "/api/together/invite/request", { token })).status()).toBe(404);

  const waiting = (await (await anna.request.get("/api/together/space")).json()) as { space: { status: string; pendingRequest: { displayName: string } } };
  expect(waiting.space.status).toBe("pending");
  expect(waiting.space.pendingRequest.displayName).toContain("Борис");
  expect((await post(boris, "/api/together/invite/confirm", { accept: true })).status()).toBe(404);
  expect((await post(anna, "/api/together/invite/confirm", { accept: "yes" })).status()).toBe(400);
  expect((await post(anna, "/api/together/invite/confirm", { accept: true })).status()).toBe(200);

  for (const page of [anna, boris]) {
    const view = (await (await page.request.get("/api/together/space")).json()) as { space: { status: string; members: unknown[]; access: { active: boolean; canRenew: boolean } } };
    expect(view.space.status).toBe("active");
    expect(view.space.members).toHaveLength(2);
    expect(view.space.access).toMatchObject({ active: false, canRenew: true });
  }
  expect((await post(vera, "/api/together/invite/request", { token })).status()).toBe(404);

  // Оплата: сумма и срок задаются сервером; через старый маршрут отчётов этот продукт купить нельзя
  expect((await post(boris, "/api/purchases", { product: "together_30d", targetId: spaceId, email: EMAIL })).status()).toBe(404);
  expect((await post(vera, "/api/together/purchases", { email: EMAIL })).status()).toBe(404);
  expect((await post(boris, "/api/together/purchases", { email: "bad" })).status()).toBe(400);
  const started = await post(boris, "/api/together/purchases", { email: EMAIL });
  expect(started.status()).toBe(200);
  const { url, purchaseId } = (await started.json()) as { url: string; purchaseId: string };
  const paymentId = url.split("/dev/pay/")[1]!;

  const paid = await boris.request.post(`/api/dev/pay/${paymentId}`, { form: { outcome: "succeeded" }, headers: origin, maxRedirects: 0 });
  expect(paid.status()).toBe(303);
  expect(paid.headers().location).toContain("/together?purchase=");

  for (const page of [anna, boris]) {
    const view = (await (await page.request.get("/api/together/space")).json()) as { space: { access: { active: boolean; stage: number; accessUntil: string } } };
    expect(view.space.access).toMatchObject({ active: true, stage: 0 });
    expect(Date.parse(view.space.access.accessUntil)).toBeGreaterThan(Date.now());
  }
  expect(await (await anna.request.get(`/api/together/purchases/${purchaseId}`)).json()).toMatchObject({ ok: true, status: "succeeded", granted: true });
  expect((await vera.request.get(`/api/together/purchases/${purchaseId}`)).status()).toBe(404);
  // Служебный список виден только владелице
  expect((await vera.request.get("/api/admin/together")).status()).toBe(404);

  // Выход: нужно подтверждение, затем закрывается для обоих
  expect((await post(boris, "/api/together/leave", {})).status()).toBe(400);
  expect((await post(boris, "/api/together/leave", { acknowledged: true })).status()).toBe(200);
  for (const page of [anna, boris]) {
    expect(((await (await page.request.get("/api/together/space")).json()) as { space: unknown }).space).toBeNull();
  }
  expect((await post(anna, "/api/together/spaces")).status()).toBe(200);
});

test("requests from another origin and without a session are refused", async ({ browser }) => {
  const anonymous = await (await browser.newContext()).newPage();

  expect((await anonymous.request.post("/api/together/spaces", { headers: origin })).status()).toBe(401);
  expect((await anonymous.request.post("/api/together/spaces", { headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await anonymous.request.get("/api/together/space")).status()).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Подготовка (локально, как для прежних e2e): в одном терминале `pnpm dev:db`, в другом `pnpm dev:web` (оба читают `apps/web/.env.development.local`: должны быть `DEV_LOGIN=1`, `PAYMENTS_FAKE=1`, `DATABASE_POOL_MAX=1`; миграции применяются командой, описанной в `packages/db/scripts/dev-db.mjs`/`migrate.mjs`, — выполнить её для новой миграции `0005`).
Run: `pnpm test:e2e e2e/together.spec.ts`
Expected: до миграции и запуска сервера — FAIL (500 от маршрутов или недоступный сервер). Если сервер не запущен, сначала запустить и убедиться, что прежний `e2e/purchase.spec.ts` проходит, чтобы отделить проблемы окружения от проблем нового кода.

- [ ] **Step 3: Align docs and run the scenario**

3a. Выровнять `docs/superpowers/specs/2026-10-05-together-backend-design.md` с реализацией:
- в разделе про приглашение вместо «конфигурация `TOGETHER_INVITE_TTL_DAYS`» написать «константа `TOGETHER_INVITE_TTL_DAYS = 7` в `packages/core`»;
- маршрут владельца: «`GET /api/admin/together` (проверка владельца как у `/admin/receipts`)» вместо `/api/owner/together`;
- в разделе «Оплата» добавить: «возврат с оплаты ведёт на `/together?purchase=<id>`; статус — `GET /api/together/purchases/[id]`»;
- в `canRenew` заменить «меньше 30 суток» на «не больше 30 суток» и пояснить: «потолок оплаченного вперёд — 60 суток: сразу после первой оплаты второй платёж допустим, третий нет».

3b. `docs/together/adr/ADR-001-together-space.md`: в решении 3 заменить «Значение в конфигурации `TOGETHER_INVITE_TTL_DAYS`» на «Константа `TOGETHER_INVITE_TTL_DAYS` в `packages/core`»; решение 5 уже сформулировано как потолок 60 суток; сверить текст с реализацией.

3c. `docs/together/CLAUDE_HANDOFF.md`: заменить абзац «**Статус этапа 0.** …» записью:

```markdown
**Статус этапа 0.** Код подготовлен в `feat/together-backend`. Контракт для экранов (этап 1, Codex):
`POST /api/together/spaces` → `{ ok, spaceId, inviteUrl }` (ссылка `/together/invite/<token>`, токен показывается один раз);
`POST /api/together/invite` (перевыпуск); `GET /api/together/invite/[token]` → `{ ok, valid }`;
`POST /api/together/invite/request` `{ token }`; `POST /api/together/invite/confirm` `{ accept: boolean }`;
`POST /api/together/leave` `{ acknowledged: true }`; `GET /api/together/space` → `{ ok, space | null }`
(`status`, `myRole`, `members[]`, `pendingRequest`, `access: { active, accessUntil, stage, canRenew }`);
`POST /api/together/purchases` `{ email }` → `{ ok, url, purchaseId }`; `GET /api/together/purchases/[id]` → `{ ok, status, granted }`.
Коды ошибок: 400 неверный ввод/нет подтверждения, 401 нет входа, 403 чужой origin, 404 не найдено/нейтральный отказ, 409 конфликт состояния, 429 лимит, 502 шлюз, 503 оплата не настроена.
Возврат с оплаты: `/together?purchase=<id>` — страницы `/together` и `/together/invite/[token]` делает этап 1.
Проверено: <заполнить фактическими числами после запуска `pnpm test:coverage`, `pnpm typecheck`, `pnpm test:e2e e2e/together.spec.ts`>. PR, слияние и деплой не выполнялись.
Ограничения: нет экранов, `returnTo`, вопросов и ответов, книги, уведомлений, автосписания и возвратов по webhook; политика остатка при выходе и автоматизация чеков остаются решениями владельца.
Следующая задача: этап 1 (экраны входа/создания/приглашения/оплаты, `returnTo`).
```
Строку «Проверено: <…>» заменить реальными результатами в Step 4; плейсхолдер не оставлять.

3d. Запустить сценарий: `pnpm test:e2e e2e/together.spec.ts`.

- [ ] **Step 4: Full verification and review**

Run последовательно, зафиксировать фактический вывод:
1. `pnpm typecheck` — без ошибок.
2. `pnpm test:coverage` — все тесты зелёные, пороги 80% выполнены (если новые файлы просели, добавить недостающие тесты, а не снижать порог).
3. `pnpm test:e2e e2e/together.spec.ts e2e/purchase.spec.ts` — зелёные (старые покупки не затронуты).
4. `git diff origin/feat/together-prototype --stat` — убедиться, что изменены только ожидаемые файлы, существующие миграции не тронуты.
5. Запустить ревью: агент `ecc:code-reviewer` по `git diff origin/feat/together-prototype...HEAD`, затем `ecc:security-reviewer` (аутентификация, ввод, БД, платежи). Исправить все CRITICAL и HIGH, MEDIUM — по возможности; повторить шаги 1–3 после правок.
6. Подставить в `CLAUDE_HANDOFF.md` реальные числа (сколько тестов, покрытие, результат e2e) вместо плейсхолдера.

- [ ] **Step 5: Commit and hand over (без push)**

```bash
git add e2e/together.spec.ts docs
git commit -m "test(together): end-to-end two-account scenario; docs aligned with implementation"
git log --oneline origin/feat/together-prototype..HEAD
```

Остановиться. Сообщить владельцу раздельно: код подготовлен; проверки выполнены (с числами); PR не создан; слияние/деплой не выполнялись. Push и PR (на ветку `feat/together-prototype`, стопкой поверх #37) — только после команды владельца.

---

## Self-Review

**1. Spec coverage**

| Раздел спецификации | Задача |
|---|---|
| Таблицы `together_*`, индексы, check | Task 2 (+ тесты инвариантов) |
| Изменения `purchases` (enum, `space_id`, check) | Task 2 |
| Чистая логика доступа, `canRenew`, этапы, обрезка закрытием | Task 1 |
| Создание, просмотр, запрос, подтверждение, перевыпуск, выход | Task 3, Task 5 |
| Удаление аккаунта закрывает пространство | Task 3 |
| `startTogetherPurchase`, повторное использование, потолок периода | Task 4 (`reserveSpacePurchase`), Task 6 |
| Выдача доступа, самовосстановление, закрытое пространство | Task 4, Task 6 |
| Диспетчеризация по продукту, старые продукты без изменений | Task 2 (типы), Task 6 |
| Список владельца | Task 4, Task 7 |
| API-контракт | Task 7, Task 8 (e2e, handoff) |
| Безопасность (origin, лимит, хеш токена, нейтральные ответы, ревью) | Task 3, Task 7, Task 8 Step 4 |
| ADR-001 и обновление handoff | Task 8 |
| Тест, что `/api/purchases` отвергает `together_30d` | Task 6 |

Пробел, выявленный при проверке: спецификация называет `GET /api/purchases/[id]` для `together_30d` с `reportUrl` на `/together`. Реализация сознательно отклоняется: для такой покупки старый маршрут возвращает 404, статус читается из `GET /api/together/purchases/[id]`; это закреплено в спецификации (Task 8, шаг 3a) и в handoff.

**2. Placeholder scan.** Единственный намеренный маркер — «<заполнить …>» в тексте handoff Task 8, с явным требованием заменить его в Step 4.6. Описания «исправления по месту» в Task 2 (чистка тестового файла) и Task 3 (сортировка участников, приведение `tx`) даны с конкретным кодом и условием применения.

**3. Type consistency.** `PurchaseProduct`/`TOGETHER_PRODUCT` (Task 1) используются в Tasks 2, 4, 6; `createPurchase` принимает `PurchaseTarget` (Task 2) и вызывается с `{ spaceId }` (Task 4 тесты); `reserveSpacePurchase` возвращает `PurchaseRecord` через `toPurchaseRecord` (Task 2 экспорт); DB-слой использует поле `reason`, сервис переименовывает в `error` (Task 5), а маршруты (Task 7) используют `error`; `TogetherDeps` (Task 5) собирается в `authorizeTogether` (Task 7); `PaymentsDeps` (существующий) используется в Task 6 и 7.

**4. Review Focus.** Каждая из восьми строк привязана к задаче с тестом: (1) Task 3 `createSpace`/`requestJoin`; (2) Task 3 и Task 8; (3) Task 4 и Task 6; (4) Task 3 (`delete-user`, удалённый запросивший); (5) Task 1; (6) Task 6 (`old purchase entry points`, `getPurchaseView`); (7) Task 6 (`a crash between…`); (8) Task 6 (`allows one period ahead…`), Task 4 (`is not available…`).
