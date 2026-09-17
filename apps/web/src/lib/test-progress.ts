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

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

export function pageItems<T>(items: readonly T[], page: number): readonly T[] {
  return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export function answeredCount(items: readonly WithId[], answers: Answers): number {
  return items.filter((item) => answers[item.id] !== undefined).length;
}

export function isPageComplete(items: readonly WithId[], answers: Answers, page: number): boolean {
  return pageItems(items, page).every((item) => answers[item.id] !== undefined);
}

export function firstIncompletePage(items: readonly WithId[], answers: Answers): number {
  const pages = pageCount(items.length);
  for (let page = 0; page < pages; page += 1) {
    if (!isPageComplete(items, answers, page)) return page;
  }
  return pages - 1;
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
