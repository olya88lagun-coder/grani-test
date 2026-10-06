import type { Product } from "./pricing";

export const TOGETHER_PRODUCT = "together_30d";
export type TogetherProduct = typeof TOGETHER_PRODUCT;
// Покупка в БД бывает продуктом отчётов или доступом «Вдвоём»; Product остаётся только про отчёты
export type PurchaseProduct = Product | TogetherProduct;

export const TOGETHER_PERIOD_DAYS = 30;
export const TOGETHER_PRICE_KOPECKS = 59_900;
export const TOGETHER_MAX_STAGE = 12;
export const TOGETHER_INVITE_TTL_DAYS = 7;
// Записка пригласившего, которую партнёр видит на странице приглашения
export const TOGETHER_INVITE_NOTE_MAX = 200;

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

// Момент, когда накопится targetSeconds оплаченного времени (пропуски без оплаты не считаются); null, если оплаченных периодов не хватит.
// Нужен, чтобы сказать паре, когда откроется следующий месяц
export function whenProvidedReaches(periods: readonly AccessPeriod[], targetSeconds: number, closedAt: Date | null = null): Date | null {
  let remainingMs = targetSeconds * SECOND_MS;
  for (const [start, end] of effectiveIntervals(periods, closedAt)) {
    const length = end - start;
    if (remainingMs <= length) return new Date(start + remainingMs);
    remainingMs -= length;
  }
  return null;
}

// Секунд оплаченного времени, после которых открывается этап (месяц) с таким номером
export const secondsForStage = (stage: number): number => (stage * TOGETHER_PERIOD_DAYS * DAY_MS) / SECOND_MS;

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
