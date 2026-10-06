import { describe, expect, test } from "vitest";
import { checkAnswerFields, type CardSnapshot } from "./together-cards";

const card: CardSnapshot = {
  id: "c1",
  version: 1,
  kind: "intro",
  title: "Карточка",
  estimatedMinutes: 5,
  prompt: "Вопрос?",
  hint: "Подсказка",
  jointAction: "Сделайте вместе",
  skipAllowed: true,
  fields: [
    { id: "answer", type: "short_text", label: "Ответ", required: true, maxLength: 1200 },
    { id: "note", type: "short_text", label: "Заметка", required: false, maxLength: 20 },
    { id: "share_in_book", type: "boolean", label: "В книгу", required: false, availableAt: "after_reveal" },
    { id: "like", type: "boolean", label: "Нравится", required: false },
  ],
};

describe("checkAnswerFields", () => {
  test("trims text, keeps booleans and drops empty optional text", () => {
    expect(checkAnswerFields(card, { answer: "  Чай и тишина  ", note: "   ", like: false }, false)).toEqual({
      ok: true,
      fields: { answer: "Чай и тишина", like: false },
    });
  });

  test("rejects a missing, empty or whitespace-only required answer", () => {
    for (const input of [{}, { answer: "" }, { answer: "   \n " }]) {
      expect(checkAnswerFields(card, input, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    }
  });

  test("counts code points: 1200 pass, 1201 fail, an emoji is one character", () => {
    expect(checkAnswerFields(card, { answer: "я".repeat(1200) }, false).ok).toBe(true);
    expect(checkAnswerFields(card, { answer: "я".repeat(1201) }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "😀".repeat(1200) }, false).ok).toBe(true);
    expect(checkAnswerFields(card, { answer: "x", note: "😀".repeat(21) }, false)).toEqual({ ok: false, reason: "invalid_field", field: "note" });
  });

  test("rejects unknown keys, wrong types and non-object input", () => {
    expect(checkAnswerFields(card, { answer: "a", extra: "b" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "extra" });
    expect(checkAnswerFields(card, JSON.parse('{"answer":"a","__proto__":"b"}'), false)).toEqual({ ok: false, reason: "invalid_field", field: "__proto__" });
    expect(checkAnswerFields(card, { answer: 5 }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "a", like: "yes" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "like" });
    for (const input of [null, undefined, "text", ["answer"], 7]) {
      expect(checkAnswerFields(card, input, false)).toEqual({ ok: false, reason: "invalid_field", field: "" });
    }
  });

  test("rejects characters the database cannot store: NUL and lone surrogates", () => {
    expect(checkAnswerFields(card, { answer: "секрет\u0000" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "обрыв\ud83d" }, false)).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(checkAnswerFields(card, { answer: "пара 😀 цела" }, false).ok).toBe(true);
  });

  test("allows an after-reveal field only once the answers are revealed, even when it is false", () => {
    expect(checkAnswerFields(card, { answer: "a", share_in_book: false }, false)).toEqual({ ok: false, reason: "field_not_available", field: "share_in_book" });
    expect(checkAnswerFields(card, { answer: "a", share_in_book: true }, true)).toEqual({ ok: true, fields: { answer: "a", share_in_book: true } });
  });
});
