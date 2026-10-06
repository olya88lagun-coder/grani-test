import { describe, expect, test } from "vitest";
import month01 from "./month-01.json";
import month02 from "./month-02.json";
import month03 from "./month-03.json";
import month04 from "./month-04.json";
import month05 from "./month-05.json";
import month06 from "./month-06.json";
import { TOGETHER_SEASON } from "./season";

describe("together season map", () => {
  test("has six consecutive months with a title, a promise, a result and two teaser questions", () => {
    expect(TOGETHER_SEASON.map((month) => month.month)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const month of TOGETHER_SEASON) {
      expect(month.title.length, `title ${month.month}`).toBeGreaterThan(3);
      expect(month.promise.length, `promise ${month.month}`).toBeGreaterThan(20);
      expect(month.result.length, `result ${month.month}`).toBeGreaterThan(10);
      expect(month.teasers, `teasers ${month.month}`).toHaveLength(2);
      for (const teaser of month.teasers) expect(teaser.endsWith("?"), teaser).toBe(true);
    }
    expect(new Set(TOGETHER_SEASON.map((month) => month.title)).size).toBe(6);
  });

  test("never promises an outcome for the relationship or an effect on conflicts", () => {
    const text = JSON.stringify(TOGETHER_SEASON).toLowerCase();
    for (const banned of ["станете ближе", "решите конфликт", "гаранти", "навсегда", "без споров", "поможет сохранить"]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  test("keeps teasers short and neutral about who answers: no names of roles or genders", () => {
    for (const month of TOGETHER_SEASON) for (const teaser of month.teasers) expect(teaser.length, teaser).toBeLessThanOrEqual(130);
  });
});

describe("season teasers are real questions", () => {
  test("every teaser of the six months is the opening of a prompt of that month, so the spoiler is not a different question", () => {
    const prompts: Record<number, string[]> = {
      1: month01.cards.map((card) => card.prompt),
      2: month02.cards.map((card) => card.prompt),
      3: month03.cards.map((card) => card.prompt),
      4: month04.cards.map((card) => card.prompt),
      5: month05.cards.map((card) => card.prompt),
      6: month06.cards.map((card) => card.prompt),
    };
    for (const month of [1, 2, 3, 4, 5, 6]) {
      const entry = TOGETHER_SEASON.find((item) => item.month === month)!;
      for (const teaser of entry.teasers) {
        const opening = teaser.replace(/\?$/, "");
        expect((prompts[month] ?? []).some((prompt) => prompt.startsWith(opening)), teaser).toBe(true);
      }
    }
  });
});
