import type { Answer, Answers } from "@grani/core";

export const PAGE_SIZE = 5;
export const STORAGE_KEY = "grani:answers:v1";

export const ANSWER_LABELS: Readonly<Record<Answer, string>> = {
  1: "Совсем не про меня",
  2: "Скорее не про меня",
  3: "Отчасти",
  4: "Скорее про меня",
  5: "Точно про меня",
};

type WithId = { readonly id: string };

export function answeredCount(items: readonly WithId[], answers: Answers): number {
  return items.filter((item) => answers[item.id] !== undefined).length;
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.ceil(total / pageSize);
}

export function pageItems<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): readonly T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

export function isPageComplete(items: readonly WithId[], answers: Answers, page: number, pageSize = PAGE_SIZE): boolean {
  return pageItems(items, page, pageSize).every((item) => answers[item.id] !== undefined);
}

export function firstIncompletePage(items: readonly WithId[], answers: Answers, pageSize = PAGE_SIZE): number {
  const pages = pageCount(items.length, pageSize);
  for (let page = 0; page < pages; page += 1) {
    if (!isPageComplete(items, answers, page, pageSize)) return page;
  }
  return pages - 1;
}

export const SUBMIT_ERRORS: Readonly<Record<string, string>> = {
  rate_limited: "Слишком много попыток. Подождите минуту и нажмите ещё раз.",
  invalid_answers: "Не все ответы сохранились. Проверьте экраны с вопросами.",
  already_answered: "С этого браузера на вопросы по этой ссылке уже ответили.",
  own_invite: "Это ваша ссылка: отвечать по ней должны друзья, а не вы.",
  not_found: "Ссылка не работает. Попросите прислать её ещё раз.",
};

const SUBMIT_FALLBACK = "Не получилось отправить ответы. Проверьте интернет и попробуйте ещё раз.";

export function submitErrorMessage(code: string | undefined): string {
  return (code && SUBMIT_ERRORS[code]) || SUBMIT_FALLBACK;
}

export function isComplete(items: readonly WithId[], answers: Answers): boolean {
  return answeredCount(items, answers) === items.length;
}

export function withAnswer(answers: Answers, id: string, value: Answer): Answers {
  return { ...answers, [id]: value };
}

function isAnswer(value: unknown): value is Answer {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseStoredProgress(raw: string | null, items: readonly WithId[]): Answers {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const stored = parsed as Record<string, unknown>;
  const restored: Record<string, Answer> = {};
  for (const item of items) {
    const value = stored[item.id];
    if (isAnswer(value)) restored[item.id] = value;
  }
  return restored;
}
