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
    expect(styleProblems(["Ты уже могла. Может. Возможно. В твоей конкретной ситуации."], 1).sort()).toEqual(["empty_phrase", "gendered", "hedges", "past_claim"]);
  });
});

describe("gendered forms", () => {
  test.each([
    "Ты устойчив к стрессу, но важно следить за балансом.",
    "После конфликта ты взял паузу и задумался.",
    "Я готов помочь, но давай обсудим условия.",
    "Мне нужно время, и я был бы рад вашей поддержке.",
    "Я хотела бы сначала понять, что случилось.",
    "Часто ты не смог сказать «нет» вовремя.",
    "В спорах ты открыт к разным точкам зрения.",
  ])("flags a form that depends on the reader's gender: %s", (text) => {
    expect(styleProblems([text], 1)).toContain("gendered");
  });

  test.each([
    "Ты устойчиво справляешься со стрессом и открываешься новому.",
    "Мне нужно время подумать, отвечу завтра.",
    "Ты стараешься сглаживать углы и берёшь паузу, чтобы успокоиться.",
    "Давай вернёмся к разговору позже, когда я смогу обсудить это спокойно.",
    "Сегодня мне хочется отдохнуть: был длинный день.",
    "Такой подход помогает, если собеседник говорил резко.",
    "Ты сначала молчишь, а потом долго переживаешь.",
  ])("leaves neutral wording alone: %s", (text) => {
    expect(styleProblems([text], 1)).not.toContain("gendered");
  });
});
