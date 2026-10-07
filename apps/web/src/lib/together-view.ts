// Чистая логика экранов «Вдвоём»: какой экран показать по ответам сервера. Права и состояние всегда подтверждает сервер,
// здесь только выбор представления; клиентским флагам доступ не доверяется

import { TOGETHER_INVITE_NOTE_MAX } from "@grani/core";

export type TogetherRole = "initiator" | "partner";
export type SpaceView = {
  status: "pending" | "active";
  myRole: TogetherRole;
  members: { role: TogetherRole; displayName: string }[];
  pendingRequest: { displayName: string } | null;
  access: { active: boolean; accessUntil: string | null; stage: number; canRenew: boolean };
};
export type PurchaseSnapshot = { status: "pending" | "succeeded" | "canceled" | "refunded"; granted: boolean };

export type SpaceScreen = "start" | "invite" | "confirm" | "ready" | "paid" | "limit";
export type PurchaseScreen = "waiting" | "delayed" | "success" | "cancelled" | "closed";

export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_ATTEMPTS = 12;

export function spaceScreen(space: SpaceView | null): SpaceScreen {
  if (!space) return "start";
  if (space.status === "pending") return space.pendingRequest ? "confirm" : "invite";
  if (!space.access.active) return "ready";
  return space.access.canRenew ? "paid" : "limit";
}

// Успех — только при подтверждённой оплате, выданном доступе и действующем активном пространстве:
// один исторический granted не обещает программу, если пространство закрыто
export function purchaseOutcome(purchase: PurchaseSnapshot, space: SpaceView | null): PurchaseScreen {
  if (purchase.status === "pending") return "waiting";
  if (purchase.status !== "succeeded") return "cancelled";
  if (!purchase.granted) return "delayed";
  return space && space.status === "active" && space.access.active ? "success" : "closed";
}

export type ActionError = { text: string; retry?: true; reload?: true; login?: true };

const ACTION_ERRORS: Readonly<Record<string, ActionError>> = {
  busy: { text: "Платёж ещё создаётся. Повторяем попытку.", retry: true },
  not_available: { text: "Сейчас оплата недоступна. Проверим состояние вашего пространства.", reload: true },
  unauthorized: { text: "Нужно войти заново. После входа вернём вас к оплате.", login: true },
  payments_unavailable: { text: "Оплата пока недоступна. Возвращайтесь позже, ничего не списано." },
  payment_failed: { text: "Не удалось подготовить оплату. Деньги не списаны, попробуйте ещё раз." },
  invalid_email: { text: "Проверьте адрес электронной почты для чека." },
  rate_limited: { text: "Слишком много попыток. Подождите минуту и повторите." },
  too_long: { text: `Записка длиннее ${TOGETHER_INVITE_NOTE_MAX} символов. Сократите её.` },
  consent_required: { text: "Отметьте согласие, чтобы продолжить." },
  not_pending: { text: "Пространство уже изменилось. Обновляем данные.", reload: true },
};
const FALLBACK_ERROR: ActionError = { text: "Не получилось выполнить действие. Проверьте соединение и попробуйте снова." };

export const startErrorMessage = (code: string): ActionError => ACTION_ERRORS[code] ?? FALLBACK_ERROR;

// Срок доступа показывается в часовом поясе человека, с датой и временем
export function formatAccessUntil(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}
