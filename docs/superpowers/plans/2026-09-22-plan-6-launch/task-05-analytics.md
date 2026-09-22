# Задача 5 — Cookie-баннер, Яндекс.Метрика и цели, код Вебмастера

**Files:**
- Create: `apps/web/src/lib/analytics.ts`, `apps/web/src/lib/analytics.test.ts`
- Create: `apps/web/src/components/Analytics.tsx` (баннер + загрузка Метрики + просмотры страниц)
- Create: `apps/web/src/components/CookieSettingsButton.tsx`
- Create: `apps/web/src/components/GoalOnQuery.tsx`
- Modify: `apps/web/src/app/layout.tsx` (`<Analytics />`, `verification.yandex`)
- Modify: `apps/web/src/components/Footer.tsx` (кнопка «Настройки cookie»)
- Modify: `apps/web/src/components/Questionnaire.tsx` (цели начала и конца)
- Modify: `apps/web/src/app/test/page.tsx`, `apps/web/src/app/f/[token]/page.tsx` (какие цели передать)
- Modify: `apps/web/src/components/InviteLink.tsx` (цель при «Поделиться»)
- Modify: `apps/web/src/app/result/[id]/FriendsBlock.tsx`, `PairsBlock.tsx` (какие цели передать)
- Modify: `apps/web/src/components/PurchaseStatus.tsx` (цель покупки)
- Modify: `apps/web/src/server/login-response.ts` (метка `?from=login` после входа)
- Modify: `apps/web/src/app/result/[id]/page.tsx` (`<GoalOnQuery />`)
- Modify: `apps/web/src/app/globals.css` (баннер)

**Interfaces:**
- Produces (`analytics.ts`):
  - `METRIKA_ID: number`, `YANDEX_VERIFICATION: string`;
  - `GOALS` — массив целей, `type Goal`;
  - `CONSENT_KEY = "grani-cookie-consent"`, `type CookieChoice = "all" | "necessary"`;
  - `readChoice(storage): CookieChoice | null`, `saveChoice(storage, choice)`;
  - `reachGoal(goal, params?)` — ничего не делает, пока нет `window.ym`;
  - `sanitizePath(path): string` — заменяет идентификаторы и токены в адресе на `:id`;
  - `goalForProduct(product): Goal`.
- `Questionnaire` получает необязательные `startGoal?: Goal` и `finishGoal?: Goal`; `InviteLink` — `shareGoal?: Goal`; `PurchaseStatus` читает `view.product`.

## Зачем

Спецификация 5.3: Метрика с целями `test_start`, `test_finish`, `login`, `invite_shared`, `friend_answered`, `purchase_full`, `purchase_chapter`, загружается только после согласия в cookie-баннере. Для воронки из раздела 8 спецификации добавлены `pair_invite_shared` («Отправили приглашение партнёру / вошли») и `purchase_pair` («Купили разбор пары / созданные пары»).

Приватность:
- Вебвизор выключен.
- Метрика инициализируется с `defer: true`, поэтому просмотр страницы уходит только нашим вызовом `hit`. В этом вызове адрес «очищен»: `/result/<uuid>` → `/result/:id`, `/f/<token>` → `/f/:id`. Иначе в Метрику попали бы идентификаторы результатов и секретные ссылки-приглашения.
- Та же очистка применяется к `referer`.

## Шаги

- [ ] **Шаг 1. Номер счётчика и код Вебмастера.** Получить от пользователя (предварительные действия 2 и 3). Это не секреты, они видны в коде страницы.

- [ ] **Шаг 2. Тест `analytics.test.ts` (RED).**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONSENT_KEY, GOALS, goalForProduct, reachGoal, readChoice, sanitizePath, saveChoice } from "./analytics";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("cookie choice", () => {
  it("reads only known values", () => {
    expect(readChoice(memoryStorage())).toBeNull();
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: "all" }))).toBe("all");
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: "yes" }))).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readChoice(broken)).toBeNull();
    expect(() => saveChoice(broken, "necessary")).not.toThrow();
  });
});

describe("sanitizePath", () => {
  it("hides ids and invite tokens", () => {
    expect(sanitizePath("/result/0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f")).toBe("/result/:id");
    expect(sanitizePath("/report/0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f?x=1")).toBe("/report/:id");
    expect(sanitizePath("/f/AbC123xyz/done")).toBe("/f/:id/done");
    expect(sanitizePath("/p/AbC123xyz")).toBe("/p/:id");
    expect(sanitizePath("/pair/0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f")).toBe("/pair/:id");
    expect(sanitizePath("/purchases/0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f")).toBe("/purchases/:id");
  });

  it("keeps public pages as they are, without the query", () => {
    expect(sanitizePath("/types/iskra")).toBe("/types/iskra");
    expect(sanitizePath("/?deleted=1")).toBe("/");
  });
});

describe("goals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has the spec goals plus the pair ones", () => {
    expect(GOALS).toEqual(["test_start", "test_finish", "login", "invite_shared", "pair_invite_shared", "friend_answered", "purchase_full", "purchase_chapter", "purchase_pair"]);
  });

  it("maps products to purchase goals", () => {
    expect(goalForProduct("full")).toBe("purchase_full");
    expect(goalForProduct("chapter_money")).toBe("purchase_chapter");
    expect(goalForProduct("chapters_all")).toBe("purchase_chapter");
    expect(goalForProduct("pair")).toBe("purchase_pair");
  });

  it("does nothing before Metrika is loaded and calls ym after", () => {
    vi.stubGlobal("window", {});
    expect(() => reachGoal("test_start")).not.toThrow();
    const ym = vi.fn();
    vi.stubGlobal("window", { ym });
    reachGoal("login");
    expect(ym).toHaveBeenCalledWith(expect.any(Number), "reachGoal", "login", undefined);
  });
});
```

- [ ] **Шаг 3. `analytics.ts`.**

```ts
import type { Product } from "@grani/core";

export const METRIKA_ID = 0; // номер счётчика от пользователя
export const YANDEX_VERIFICATION = ""; // content метатега Вебмастера от пользователя

export const GOALS = ["test_start", "test_finish", "login", "invite_shared", "pair_invite_shared", "friend_answered", "purchase_full", "purchase_chapter", "purchase_pair"] as const;
export type Goal = (typeof GOALS)[number];

export const CONSENT_KEY = "grani-cookie-consent";
export type CookieChoice = "all" | "necessary";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

// localStorage бывает недоступен (приватный режим, запрет сайта) — тогда баннер просто спросит снова
export function readChoice(storage: StorageLike): CookieChoice | null {
  try {
    const value = storage.getItem(CONSENT_KEY);
    return value === "all" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
}

export function saveChoice(storage: StorageLike, choice: CookieChoice): void {
  try {
    storage.setItem(CONSENT_KEY, choice);
  } catch {
    // выбор действует до перезагрузки
  }
}

const PRIVATE_SEGMENTS = /^\/(result|report|pair|purchases|p|f|cards\/manual|dev\/pay)\/[^/]+/;

export function sanitizePath(path: string): string {
  const [pathname] = path.split(/[?#]/);
  return (pathname || "/").replace(PRIVATE_SEGMENTS, (_, section: string) => `/${section}/:id`);
}

export function goalForProduct(product: Product): Goal {
  if (product === "full") return "purchase_full";
  if (product === "pair") return "purchase_pair";
  return "purchase_chapter";
}

type Ym = (id: number, method: string, ...args: unknown[]) => void;

export function reachGoal(goal: Goal, params?: Record<string, string | number>): void {
  const ym = (globalThis as { window?: { ym?: Ym } }).window?.ym;
  ym?.(METRIKA_ID, "reachGoal", goal, params);
}
```

Шаблон `/p/:id` проверить на ложные совпадения: `/privacy` не начинается с `/p/`, но в тесте всё равно добавить `expect(sanitizePath("/privacy")).toBe("/privacy")`. Прогнать тест: PASS.

- [ ] **Шаг 4. `Analytics.tsx`.** Клиентский компонент в `layout.tsx`:
  - На монтировании читает выбор. `null` → показывает баннер. `all` → загружает Метрику. `necessary` → ничего не делает.
  - Баннер — фиксированная плашка снизу (`position: fixed; inset-inline: 16px; bottom: calc(16px + env(safe-area-inset-bottom))`), фон `--surface-2`, скругление `--radius`, без теней. Текст: «Мы используем cookie, чтобы сайт работал. С вашего разрешения — ещё и Яндекс.Метрику для статистики посещений. Подробнее — в политике» (ссылка `/privacy`). Кнопки «Принять» (`button`) и «Только необходимые» (`button button--ghost`). `role="dialog"`, `aria-label="Cookie"`, фокус не перехватывает.
  - Загрузка: вставляет `<script async src="https://mc.yandex.ru/metrika/tag.js">` один раз. До загрузки ставит очередь `window.ym = window.ym || function(){(window.ym.a = window.ym.a || []).push(arguments)}; window.ym.l = Date.now()` — это стандартный код Метрики.
  - Затем `ym(METRIKA_ID, "init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false })`.
  - Просмотры: `usePathname()` в эффекте, `ym(METRIKA_ID, "hit", location.origin + sanitizePath(pathname), { referer: document.referrer ? sanitizeReferrer(document.referrer) : undefined })`. Для внешних рефереров адрес не меняется, для своих — `sanitizePath`. `sanitizeReferrer` добавить в `analytics.ts` с тестом.
  - Первый `hit` уходит сразу после `init`.
  - Слушает событие `window` `grani:cookie-settings`: снова показывает баннер. Если человек сменил `all` на `necessary`, сохранить выбор и перезагрузить страницу: выгрузить уже загруженную Метрику иначе нельзя.
  - `METRIKA_ID === 0` (счётчик не настроен: локальная разработка, сквозные тесты) — баннер работает как обычно, но скрипт Метрики не загружается и `ym` не вызывается.

- [ ] **Шаг 5. «Настройки cookie».** `CookieSettingsButton.tsx` — клиентская кнопка-ссылка (`className="link-button"`, выглядит как ссылки подвала), `onClick={() => window.dispatchEvent(new Event("grani:cookie-settings"))}`. Вставить в `Footer`.

- [ ] **Шаг 6. Цели.**
  - `Questionnaire`: `startGoal` — при первом ответе, если в сохранённом прогрессе ответов не было; `finishGoal` — после успешной отправки, перед переходом.
  - `test/page.tsx`: `startGoal="test_start" finishGoal="test_finish"`.
  - Анкета друга (`f/[token]/page.tsx`): `finishGoal="friend_answered"`.
  - `InviteLink`: `shareGoal` — после успешного `navigator.share` или копирования. `FriendsBlock` → `invite_shared`, `PairsBlock` → `pair_invite_shared`.
  - Вход: `login-response.ts` строит адрес перехода после входа (на результат или `/test`). Добавить к нему `from=login`, а на странице результата — `<GoalOnQuery param="from" value="login" goal="login" />`. Этот клиентский компонент при совпадении зовёт `reachGoal` и убирает параметр через `history.replaceState`, чтобы перезагрузка не засчитала вход второй раз. Тест `login-service.test.ts` / `login-response` обновить под новый адрес.
  - `PurchaseStatus`: при первом `view.ready` или `view.status === "succeeded"` — `reachGoal(goalForProduct(view.product), { order_price: view.amountKopecks / 100 })`, один раз на покупку (ключ `grani-goal-<purchaseId>` в `sessionStorage`, в `try/catch`). Если в `view` нет `product` и `amountKopecks`, добавить их в `getPurchaseView` и его тест.

  Цель, отправленная до согласия, теряется (`reachGoal` без `ym` ничего не делает) — это ожидаемо: без согласия статистики нет.

- [ ] **Шаг 7. Код Вебмастера.** В `layout.tsx` `metadata.verification = { yandex: YANDEX_VERIFICATION }` (если строка непустая).

- [ ] **Шаг 8. Проверка.**
  - `pnpm typecheck`, `pnpm vitest run apps/web`.
  - В превью с временно подставленным номером счётчика (не коммитить, если номера ещё нет):
    1. первый заход — баннер;
    2. «Только необходимые» → в сети нет запросов к `mc.yandex.ru`, после перезагрузки баннера нет;
    3. «Настройки cookie» → баннер снова;
    4. «Принять» → запрос `tag.js`, а `hit` уходит с `/result/:id`, а не с uuid (`read_network_requests`, фильтр `mc.yandex`);
    5. пройти тест — в запросах видны цели `test_start`, `test_finish`, `login`.
  - На 375px баннер не закрывает кнопку «Далее» теста так, что её нельзя нажать: пока баннер открыт, у `body` есть отступ снизу на высоту баннера.
  - Скриншот баннера на 375px.

- [ ] **Шаг 9. Коммит.**

```bash
git add apps/web/src/lib/analytics.ts apps/web/src/lib/analytics.test.ts apps/web/src/components apps/web/src/app/layout.tsx apps/web/src/app/test apps/web/src/app/f apps/web/src/app/result apps/web/src/server apps/web/src/app/globals.css
git commit -m "feat(analytics): cookie banner, Yandex Metrika after consent with funnel goals, Webmaster verification"
```
