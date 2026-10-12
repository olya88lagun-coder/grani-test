import { describe, expect, test } from "vitest";
import { hedgeCount, styleProblems } from "./chapter-style";

describe("hedgeCount", () => {
  test("counts hedges in any case and ignores words that only contain them", () => {
    expect(hedgeCount("Это может помочь. Возможно, стоит попробовать, и можно сравнить варианты.")).toBe(3);
    expect(hedgeCount("Приложение поможет сложить цифры.")).toBe(0);
  });
});

describe("styleProblems", () => {
  test("accepts direct text with one hedge", () => {
    expect(styleProblems(["Скажи прямо: «Сегодня не могу».", "Это может занять неделю."], 1)).toEqual([]);
  });

  test("flags a second hedge, empty phrases and claims about the past", () => {
    expect(styleProblems(["Может помочь. Возможно, получится."], 1)).toEqual(["hedges"]);
    expect(styleProblems(["Полезный подход — тот, который помогает в твоей конкретной ситуации."], 1)).toEqual(["empty_phrase"]);
    expect(styleProblems(["Ты уже много раз отдавал деньги."], 1)).toEqual(["past_claim"]);
    expect(styleProblems(["Ты всегда откладываешь."], 1)).toEqual(["past_claim"]);
  });

  test("reports each kind of problem once", () => {
    expect(styleProblems(["Ты уже могла. Может. Возможно. В твоей конкретной ситуации."], 1).sort()).toEqual(["empty_phrase", "hedges", "past_claim"]);
  });
});
