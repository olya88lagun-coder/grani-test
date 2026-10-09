import type { Product } from "@grani/core";

// Номер счётчика и код Вебмастера видны в коде страницы любому, это не секреты
export const METRIKA_ID = 112931559;
export const YANDEX_VERIFICATION = "358d0b8f55e03e89";

export const GOALS = [
  "test_start",
  "test_finish",
  "login",
  "invite_shared",
  "pair_invite_shared",
  "friend_answered",
  "purchase_full",
  "purchase_chapter",
  "purchase_pair",
  // Воронка по ТЗ: прогресс теста, просмотр результата, сторис, интерес к разбору и переход к оплате
  "test_25",
  "test_50",
  "test_75",
  "result_view",
  "story_share",
  "report_click",
  "checkout_start",
] as const;
export type Goal = (typeof GOALS)[number];

const PROGRESS_GOALS = [
  [25, "test_25"],
  [50, "test_50"],
  [75, "test_75"],
] as const satisfies readonly (readonly [number, Goal])[];

// Цели прогресса, чей порог ответ пересёк: before — ответов до, after — после, total — всего вопросов
export function progressGoalsCrossed(before: number, after: number, total: number): Goal[] {
  const percent = (count: number) => (count * 100) / total;
  return PROGRESS_GOALS.filter(([threshold]) => percent(before) < threshold && percent(after) >= threshold).map(([, goal]) => goal);
}

export const CONSENT_KEY = "grani-cookie-consent";
export const COOKIE_SETTINGS_EVENT = "grani:cookie-settings";
export const ANALYTICS_READY_EVENT = "grani:analytics-ready";
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

// Устройство владелицы: отмечается на странице чеков, и Метрика на нём не загружается — свои визиты статистику не портят
export const OWNER_DEVICE_KEY = "grani-owner-device";

export function isOwnerDevice(storage: StorageLike): boolean {
  try {
    return storage.getItem(OWNER_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOwnerDevice(storage: StorageLike): void {
  try {
    storage.setItem(OWNER_DEVICE_KEY, "1");
  } catch {
    // Хранилище недоступно — отметка не сохранится, визиты с этого устройства будут считаться
  }
}

export function saveChoice(storage: StorageLike, choice: CookieChoice): void {
  try {
    storage.setItem(CONSENT_KEY, choice);
  } catch {
    // выбор действует до перезагрузки страницы
  }
}

// Идентификаторы результатов и токены приглашений не должны попадать в Метрику
const PRIVATE_SEGMENTS = /^\/(result|report|pair|purchases|p|f|cards\/manual|dev\/pay|together\/invite)\/[^/]+/;

export function sanitizePath(path: string): string {
  const [pathname] = path.split(/[?#]/);
  return (pathname || "/").replace(PRIVATE_SEGMENTS, (_, section: string) => `/${section}/:id`);
}

export function sanitizeReferrer(referrer: string, origin: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    return url.origin === origin ? `${origin}${sanitizePath(url.pathname)}` : url.origin;
  } catch {
    return undefined;
  }
}

export function goalForProduct(product: Product): Goal {
  if (product === "full") return "purchase_full";
  if (product === "pair") return "purchase_pair";
  return "purchase_chapter";
}

// Вход — серверный редирект, поэтому цель отмечается меткой в адресе и снимается на первой странице после входа
export const LOGIN_MARK = { param: "from", value: "login" } as const;

export function withLoginMark(path: string): string {
  const url = new URL(path, "https://grani-test.ru");
  url.searchParams.set(LOGIN_MARK.param, LOGIN_MARK.value);
  return `${url.pathname}${url.search}${url.hash}`;
}

type Ym = (id: number, method: string, ...args: unknown[]) => void;

export function reachGoal(goal: Goal, params?: Record<string, string | number>): void {
  const ym = (globalThis as { window?: { ym?: Ym } }).window?.ym;
  ym?.(METRIKA_ID, "reachGoal", goal, params);
}
