// Чистая логика карточек «Вдвоём»: что отправлять, что проверять до отправки, как читать ошибки сервера.
// Состояние, права и ответ партнёра приходят только от сервера; здесь нет ничего, что давало бы доступ

export type CardState = "answer" | "waiting" | "revealed" | "skipped";
export type CardFieldView = { id: string; type: "short_text" | "boolean"; label: string; required: boolean; maxLength?: number; availableAt?: "after_reveal" };
export type AnswerValues = Record<string, string | boolean>;
export type PartnerView = { status: "none" | "answered" | "skipped"; fields?: AnswerValues; edited?: boolean; done?: boolean };
export type CardView = {
  id: string;
  position: number;
  kind: "intro" | "main";
  title: string;
  prompt: string;
  hint: string;
  estimatedMinutes: number;
  jointAction: string;
  fields: CardFieldView[];
  state: CardState;
  locked: boolean;
  lock: CardLockView | null;
  mine: { fields: AnswerValues; revision: number; done: boolean } | null;
  partner: PartnerView;
};
export type CardLockView = { kind: "payment" } | { kind: "month"; month: number; opensAt: string | null };
export type Progress = { done: number; total: number };
export type HistoryItem = {
  id: string;
  position: number;
  title: string;
  prompt: string;
  outcome: "revealed" | "skipped";
  mine: { fields: AnswerValues; revision: number } | null;
  partner: { status: "none" | "answered" | "skipped"; fields?: AnswerValues; edited?: boolean };
};

export const CARD_POLL_INTERVAL_MS = 8000;
export const CARD_POLL_MAX_ATTEMPTS = 30;

// Тело PUT: только поля из снимка карточки. Поля «после раскрытия» до раскрытия не отправляются вообще (даже false):
// сервер отвечает на них 400. Пустой необязательный текст не отправляется
export function serializeAnswer(card: CardView, draft: AnswerValues, revealed: boolean): AnswerValues {
  const body: AnswerValues = {};
  for (const field of card.fields) {
    const value = draft[field.id];
    if (field.availableAt === "after_reveal" && !revealed) continue;
    if (field.type === "boolean") {
      if (typeof value === "boolean") body[field.id] = value;
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") body[field.id] = value.trim();
  }
  return body;
}

const UNSAFE_TEXT = /\u0000|\p{Cs}/u;

// Предварительная проверка для удобства человека; окончательное решение всегда за сервером
export function validateDraft(card: CardView, draft: AnswerValues): { field: string; message: string } | null {
  for (const field of card.fields) {
    if (field.type !== "short_text") continue;
    const raw = draft[field.id];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (field.required) return { field: field.id, message: "Напишите ответ: поле не может быть пустым." };
      continue;
    }
    if (UNSAFE_TEXT.test(text)) return { field: field.id, message: "Уберите недопустимые символы." };
    if (field.maxLength !== undefined && [...text].length > field.maxLength) return { field: field.id, message: `Сократите текст: не больше ${field.maxLength} символов.` };
  }
  return null;
}

export type FailureKind = "login" | "gone" | "reload" | "paywall" | "none";
export type CardFailure = { kind: FailureKind; text: string };

const NETWORK_TEXT = "Не получилось связаться с сервером. Ничего не потеряно — повторите попытку.";

// Что делать с ответом сервера об ошибке. Статус важнее кода: вход, отсутствие пространства, лимит и сбои сети
export function cardFailure(status: number, code: string): CardFailure {
  if (status === 401) return { kind: "login", text: "Нужно войти заново. После входа вернём вас к карточкам." };
  if (status === 404) return { kind: "gone", text: "Пространство недоступно." };
  if (status === 429) return { kind: "none", text: "Слишком много попыток. Подождите минуту и повторите." };
  if (status === 0 || status >= 500) return { kind: "none", text: NETWORK_TEXT };
  switch (code) {
    case "invalid_field":
      return { kind: "none", text: "Проверьте ответ: он пустой, слишком длинный или содержит недопустимые символы. Текст остался в форме." };
    case "field_not_available":
      return { kind: "reload", text: "Эта галочка станет доступна после раскрытия. Обновляем карточку." };
    case "already_closed":
      return { kind: "reload", text: "Карточка уже закрыта. Показываем актуальный итог." };
    case "already_revealed":
      return { kind: "reload", text: "Ответы уже раскрыты. Обновляем карточку." };
    case "reveal_pending":
      return { kind: "reload", text: "Сначала посмотрите итог предыдущей карточки." };
    case "not_closed":
      return { kind: "reload", text: "Карточка ещё открыта. Обновляем её." };
    case "not_yet_open":
      return { kind: "reload", text: "Этот месяц ещё не открылся. Обновляем карточку." };
    case "access_required":
      return { kind: "paywall", text: "Чтобы идти дальше по основному маршруту, откройте доступ для пары." };
    case "skip_not_allowed":
      return { kind: "none", text: "Эту карточку нельзя пропустить." };
    case "rate_limited":
      return { kind: "none", text: "Слишком много попыток. Подождите минуту и повторите." };
    case "forbidden":
    case "bad_origin":
      return { kind: "none", text: "Сессия устарела. Обновите страницу и повторите действие." };
    default:
      return { kind: "none", text: "Не получилось выполнить действие. Проверьте данные и повторите." };
  }
}

export const progressText = (progress: Progress): string => `${progress.done} из ${progress.total}`;

// Имя партнёра не склоняется: род и падеж по имени не угадываются
export function partnerStatusText(status: PartnerView["status"], name: string): string {
  if (status === "answered") return `${name}: ответ есть. Текст откроется, когда ответите вы.`;
  if (status === "skipped") return `${name}: карточка пропущена.`;
  return `${name}: ответа пока нет.`;
}

// Страницы истории приходят по убыванию позиции; повтор той же карточки не дублируется
export function mergeHistory(current: readonly HistoryItem[], incoming: readonly HistoryItem[]): HistoryItem[] {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
}

// День открытия месяца в часовом поясе человека, без времени: «4 ноября»
export function formatOpensAt(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone }).format(new Date(iso));
}

export function lockTitle(lock: Extract<CardLockView, { kind: "month" }>, timeZone?: string): string {
  return lock.opensAt ? `Месяц ${lock.month} откроется ${formatOpensAt(lock.opensAt, timeZone)}` : `Месяц ${lock.month} откроется после продления доступа`;
}
