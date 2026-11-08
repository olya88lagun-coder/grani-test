import { ALL_TYPE_CODES, TYPE_NAMES } from "@grani/core";
import { describe, expect, test } from "vitest";
import { TYPE_FAQ } from "./type-faq";

describe("TYPE_FAQ", () => {
  test("covers every type exactly once", () => {
    expect(Object.keys(TYPE_FAQ).sort()).toEqual([...ALL_TYPE_CODES].sort());
  });

  test("each type has at least three questions with substantive answers", () => {
    for (const code of ALL_TYPE_CODES) {
      const items = TYPE_FAQ[code];
      expect(items.length, code).toBeGreaterThanOrEqual(3);
      for (const item of items) {
        expect(item.question.length, code).toBeGreaterThanOrEqual(10);
        expect(item.question.endsWith("?"), code).toBe(true);
        expect(item.answer.length, code).toBeGreaterThanOrEqual(80);
        expect(item.answer.length, code).toBeLessThanOrEqual(600);
      }
    }
  });

  test("the first question names the type and questions stay unique", () => {
    const seen = new Set<string>();
    for (const code of ALL_TYPE_CODES) {
      const { name } = TYPE_NAMES[code];
      const items = TYPE_FAQ[code];
      expect(items[0]?.question.includes(name), `${code}: ${items[0]?.question}`).toBe(true);
      for (const item of items) {
        expect(seen.has(item.question), item.question).toBe(false);
        seen.add(item.question);
      }
    }
  });
});
