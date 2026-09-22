import { describe, expect, test } from "vitest";
import {
  ANSWER_LABELS,
  answeredCount,
  firstIncompletePage,
  isComplete,
  isPageComplete,
  pageCount,
  pageItems,
  parseStoredProgress,
  submitErrorMessage,
  withAnswer,
} from "./test-progress";

const items = Array.from({ length: 12 }, (_, i) => ({ id: `q-${i + 1}` }));
const answerFirst = (n: number) => Object.fromEntries(items.slice(0, n).map((item) => [item.id, 3 as const]));

describe("paging", () => {
  test("splits items into pages of five", () => {
    expect(pageCount(12)).toBe(3);
    expect(pageCount(50)).toBe(10);
    expect(pageItems(items, 0).map((item) => item.id)).toEqual(["q-1", "q-2", "q-3", "q-4", "q-5"]);
    expect(pageItems(items, 2).map((item) => item.id)).toEqual(["q-11", "q-12"]);
  });

  test("a page is complete only when every item on it is answered", () => {
    expect(isPageComplete(items, answerFirst(4), 0)).toBe(false);
    expect(isPageComplete(items, answerFirst(5), 0)).toBe(true);
  });

  test("resumes from the first page with a missing answer", () => {
    expect(firstIncompletePage(items, {})).toBe(0);
    expect(firstIncompletePage(items, answerFirst(7))).toBe(1);
    expect(firstIncompletePage(items, answerFirst(12))).toBe(2);
  });
});

describe("answers", () => {
  test("counts only answers to known items", () => {
    expect(answeredCount(items, { ...answerFirst(3), unknown: 5 })).toBe(3);
    expect(isComplete(items, answerFirst(11))).toBe(false);
    expect(isComplete(items, answerFirst(12))).toBe(true);
  });

  test("adding an answer returns a new object and keeps the original", () => {
    const before = answerFirst(1);
    const after = withAnswer(before, "q-2", 5);
    expect(after).toEqual({ "q-1": 3, "q-2": 5 });
    expect(before).toEqual({ "q-1": 3 });
  });

  test("has a label for each of the five answers", () => {
    expect(Object.keys(ANSWER_LABELS)).toEqual(["1", "2", "3", "4", "5"]);
    expect(ANSWER_LABELS[1]).toBe("Совсем не про меня");
    expect(ANSWER_LABELS[5]).toBe("Точно про меня");
  });
});

describe("stored progress", () => {
  test("restores valid answers", () => {
    expect(parseStoredProgress(JSON.stringify({ "q-1": 2, "q-2": 5 }), items)).toEqual({ "q-1": 2, "q-2": 5 });
  });

  test("drops unknown ids and values outside 1–5", () => {
    const raw = JSON.stringify({ "q-1": 4, "q-2": 0, "q-3": 6, "q-4": 2.5, "q-5": "3", other: 3 });
    expect(parseStoredProgress(raw, items)).toEqual({ "q-1": 4 });
  });

  test.each([null, "", "not json", "[1,2]", "null", "42"])("returns no answers for %j", (raw) => {
    expect(parseStoredProgress(raw, items)).toEqual({});
  });
});

describe("custom page size", () => {
  test("splits and resumes by the given page size", () => {
    expect(pageCount(12, 4)).toBe(3);
    expect(pageItems(items, 1, 4).map((item) => item.id)).toEqual(["q-5", "q-6", "q-7", "q-8"]);
    expect(isPageComplete(items, answerFirst(4), 0, 4)).toBe(true);
    expect(firstIncompletePage(items, answerFirst(9), 4)).toBe(2);
  });
});

describe("submitErrorMessage", () => {
  test("explains known errors and falls back for the rest", () => {
    expect(submitErrorMessage("already_answered")).toMatch(/уже ответ/i);
    expect(submitErrorMessage("own_invite")).toMatch(/ваша ссылка/i);
    expect(submitErrorMessage("rate_limited")).toMatch(/минуту/i);
    expect(submitErrorMessage(undefined)).toMatch(/интернет/i);
    expect(submitErrorMessage("something_new")).toMatch(/интернет/i);
  });
});
