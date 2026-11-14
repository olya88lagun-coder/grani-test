import { isFunnelStep, type PurchaseProduct } from "@grani/core";
import { SITE_URL } from "./site";

// Номер счётчика и код Вебмастера видны в коде страницы любому, это не секреты
export const METRIKA_ID = 112931559;
export const YANDEX_VERIFICATION = "358d0b8f55e03e89";

export function metrikaCounterId(origin: string): number | null {
  if (origin === SITE_URL) return METRIKA_ID;
  const value = process.env.NEXT_PUBLIC_METRIKA_TEST_ID;
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id !== METRIKA_ID ? id : null;
}

export const GOALS = [
  "test_start",
  "test_finish",
  // Шаги входа между концом теста и успешным входом: видно, где люди отваливаются — на согласии или уже на VK ID
  "login_consent",
  "login_start",
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
  // Короткие тесты: старт и завершение считаются и в Метрике, и на сервере
  "attachment_start",
  "attachment_finish",
  "temperament_start",
  "temperament_finish",
  "purchase_attachment",
  "purchase_attachment_pair",
  "purchase_together",
  "attachment_invite",
  "attachment_pair",
  // Визуальные эффекты: только Метрика, без идентификатора ответа, типа, результата и токена
  "fx_hero_seen",
  "fx_hero_move",
  "fx_hero_labels",
  "fx_trial_seen",
  "fx_trial_pick",
  "fx_trial_handoff",
  "fx_teaser_seen",
  "fx_reveal_start",
  "fx_reveal_skip",
  "fx_reveal_done",
  "fx_pair_seen",
  "fx_guess_seen",
  "fx_guess_pick",
  "fx_guess_invite",
  "fx_card_turn",
  "fx_card_reveal",
  "fx_wait_seen",
  "fx_wait_confirmed",
  "fx_facet_pick",
  "fx_friends_seen",
  "fx_pair_contact",
  "fx_trail_seen",
  "fx_reply_reveal",
  "fx_reply_skip",
  "fx_shelf_seen",
  "fx_shelf_open",
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
type ReadyWindow = Window & { graniMetrikaReady?: boolean };

// Событие означает загрузку SDK, а не только создание стандартной очереди ym.
export function notifyAnalyticsReady(): void {
  (window as ReadyWindow).graniMetrikaReady = true;
  window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
}

export function isAnalyticsReady(win: Window): boolean {
  return (win as ReadyWindow).graniMetrikaReady === true;
}
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

const PUBLIC_ENTRY = /^\/(?:$|big-five-test\/?$|articles(?:\/[a-z0-9-]+)?\/?$|types(?:\/[a-z0-9-]+)?\/?$|traits(?:\/[a-z0-9-]+)?\/?$|(?:about|pricing|compatibility|together)\/?$)/;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CAMPAIGN_VALUE = /^[\p{L}\p{N} ._~+-]{1,100}$/u;

// Только маркетинговые метки публичного входа; приватные URL, email и токены остаются очищенными.
export function analyticsHitPath(pathname: string, search: string): string {
  const clean = sanitizePath(pathname);
  if (!PUBLIC_ENTRY.test(clean)) return clean;
  const input = new URLSearchParams(search.split("#")[0]);
  const output = new URLSearchParams();
  for (const key of CAMPAIGN_KEYS) {
    const value = input.get(key);
    if (value && CAMPAIGN_VALUE.test(value)) output.set(key, value);
  }
  return output.size ? `${clean}?${output}` : clean;
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

const PURCHASE_GOALS = {
  full: "purchase_full",
  chapter_money: "purchase_chapter",
  chapter_conflict: "purchase_chapter",
  chapter_stress: "purchase_chapter",
  chapter_relationships: "purchase_chapter",
  chapters_all: "purchase_chapter",
  pair: "purchase_pair",
  attachment_solo: "purchase_attachment",
  attachment_pair: "purchase_attachment_pair",
  attachment_pair_discount: "purchase_attachment_pair",
  together_30d: "purchase_together",
} as const satisfies Record<PurchaseProduct, Goal>;

export function goalForProduct(product: PurchaseProduct): Goal {
  return PURCHASE_GOALS[product];
}

// Вход — серверный редирект, поэтому цель отмечается меткой в адресе и снимается на первой странице после входа
export const LOGIN_MARK = { param: "from", value: "login" } as const;

export function withLoginMark(path: string): string {
  const url = new URL(path, "https://grani-test.ru");
  url.searchParams.set(LOGIN_MARK.param, LOGIN_MARK.value);
  return `${url.pathname}${url.search}${url.hash}`;
}

const reachedOnce = new Set<Goal>();

// Эффект сообщает о себе один раз за загрузку страницы, а не на каждое движение или перерисовку
export function reachGoalOnce(goal: Goal): void {
  if (reachedOnce.has(goal)) return;
  reachedOnce.add(goal);
  reachGoal(goal);
}

type Ym = (id: number, method: string, ...args: unknown[]) => void;

export function reachGoal(goal: Goal, params?: Record<string, string | number>): void {
  const win = (globalThis as { window?: { location: Location; ym?: Ym; localStorage?: Storage; navigator?: Navigator } }).window;
  const counter = win?.location && metrikaCounterId(win.location.origin);
  if (counter) win.ym?.(counter, "reachGoal", goal, params);
  // Свой счётчик шагов не зависит от согласия на cookie: он не хранит ничего, кроме числа за день
  if (isFunnelStep(goal) && win?.navigator?.sendBeacon && !(win.localStorage && isOwnerDevice(win.localStorage))) win.navigator.sendBeacon("/api/funnel", goal);
}
