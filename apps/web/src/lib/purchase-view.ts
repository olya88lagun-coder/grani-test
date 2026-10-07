// Состояния страницы покупки. Оплата, готовность разбора и «ждём слишком долго» — разные вещи:
// подтверждённая оплата не означает готовый разбор, а долгое ожидание не означает ошибку и не отменяет оплату
export type PurchaseStage = "awaiting_payment" | "payment_unconfirmed" | "preparing" | "preparing_long" | "ready" | "not_paid" | "refunded";
export type PurchaseStageInput = { status: "pending" | "succeeded" | "canceled" | "refunded"; ready: boolean };

// Платёжная система обычно подтверждает за секунды; разбор обычно готовится около минуты
export const PENDING_LONG_MS = 90_000;
export const PREPARING_LONG_MS = 5 * 60_000;

export function purchaseStage(view: PurchaseStageInput, elapsedMs: number): PurchaseStage {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (view.status === "refunded") return "refunded";
  if (view.status === "canceled") return "not_paid";
  if (view.status === "pending") return elapsed >= PENDING_LONG_MS ? "payment_unconfirmed" : "awaiting_payment";
  if (view.ready) return "ready";
  return elapsed >= PREPARING_LONG_MS ? "preparing_long" : "preparing";
}

// Опрос не должен идти каждые три секунды вечно: после первых минут реже
const POLL_FAST_MS = 3_000;
const POLL_SLOW_MS = 10_000;
const POLL_SLOWEST_MS = 30_000;

export function pollDelayMs(elapsedMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (elapsed < 2 * 60_000) return POLL_FAST_MS;
  if (elapsed < 30 * 60_000) return POLL_SLOW_MS;
  return POLL_SLOWEST_MS;
}

export const STAGE_TEXT: Readonly<Record<PurchaseStage, { title: string; lead: string }>> = {
  awaiting_payment: { title: "Ждём подтверждения оплаты", lead: "Обычно это занимает несколько секунд." },
  payment_unconfirmed: {
    title: "Оплата пока не подтверждена",
    lead: "Если вы оплатили, подождите ещё немного: подтверждение приходит от платёжной системы, страница обновится сама. Если оплата не состоялась, вернитесь и попробуйте снова.",
  },
  preparing: { title: "Готовим разбор", lead: "Обычно это занимает около минуты. Страницу можно не обновлять — она откроется сама." },
  preparing_long: {
    title: "Разбор готовится дольше обычного",
    lead: "Оплата получена, деньги не пропадут. Страница откроется сама, когда разбор будет готов. Если он долго не появляется, напишите нам.",
  },
  ready: { title: "Разбор готов", lead: "Открываем страницу разбора." },
  not_paid: { title: "Оплата не прошла", lead: "Деньги не списаны. Можно попробовать ещё раз." },
  refunded: { title: "Платёж возвращён", lead: "Деньги вернутся тем же способом, которым вы платили; обычно это занимает несколько дней." },
};
