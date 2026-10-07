import { describe, expect, test } from "vitest";
import { pluralRu } from "./plural";

const DAYS = ["день", "дня", "дней"] as const;

describe("pluralRu", () => {
  test("picks the Russian form by the number", () => {
    const cases: [number, string][] = [
      [0, "дней"],
      [1, "день"],
      [2, "дня"],
      [4, "дня"],
      [5, "дней"],
      [10, "дней"],
      [11, "дней"],
      [12, "дней"],
      [14, "дней"],
      [21, "день"],
      [22, "дня"],
      [25, "дней"],
      [101, "день"],
      [111, "дней"],
      [112, "дней"],
      [121, "день"],
    ];
    for (const [count, form] of cases) expect(pluralRu(count, DAYS), String(count)).toBe(form);
  });
});
