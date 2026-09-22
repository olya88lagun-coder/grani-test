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
] as const;
export type Goal = (typeof GOALS)[number];

export const CONSENT_KEY = "grani-cookie-consent";
export const COOKIE_SETTINGS_EVENT = "grani:cookie-settings";
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
    // выбор действует до перезагрузки страницы
  }
}

// Идентификаторы результатов и токены приглашений не должны попадать в Метрику
const PRIVATE_SEGMENTS = /^\/(result|report|pair|purchases|p|f|cards\/manual|dev\/pay)\/[^/]+/;

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
