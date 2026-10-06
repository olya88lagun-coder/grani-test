import { describe, expect, test } from "vitest";
import { cardFailure, mergeHistory, partnerStatusText, progressText, serializeAnswer, validateDraft, type CardView, type HistoryItem } from "./together-cards-view";

const card: CardView = {
  id: "11111111-1111-4111-8111-111111111111",
  position: 4,
  kind: "main",
  title: "Как встречать друг друга вечером",
  prompt: "Как вам удобнее переходить от дел дня к общению?",
  hint: "Можно описать свой вариант.",
  estimatedMinutes: 5,
  jointAction: "Попробуйте вместе.",
  fields: [
    { id: "answer", type: "short_text", label: "Ответ", required: true, maxLength: 20 },
    { id: "care_action", type: "short_text", label: "Что подойдёт", required: false, maxLength: 10 },
    { id: "share_in_book", type: "boolean", label: "В книгу", required: false, availableAt: "after_reveal" },
    { id: "allow_care_reward", type: "boolean", label: "Для карточки", required: false, availableAt: "after_reveal" },
  ],
  state: "answer",
  locked: false,
  mine: null,
  partner: { status: "none" },
};

describe("serializeAnswer", () => {
  test("before the reveal sends only trimmed text and never an after-reveal key, even when it is false", () => {
    const body = serializeAnswer(card, { answer: "  Тишина  ", care_action: "   ", share_in_book: false, allow_care_reward: false }, false);

    expect(body).toEqual({ answer: "Тишина" });
    expect("share_in_book" in body).toBe(false);
    expect("allow_care_reward" in body).toBe(false);
  });

  test("after the reveal keeps the booleans the person set and ignores unknown keys", () => {
    expect(serializeAnswer(card, { answer: "Тишина", share_in_book: true, allow_care_reward: false, stray: "x" }, true)).toEqual({
      answer: "Тишина",
      share_in_book: true,
      allow_care_reward: false,
    });
  });
});

describe("validateDraft", () => {
  test("requires the main answer and counts code points against the limit", () => {
    expect(validateDraft(card, { answer: "   " })?.field).toBe("answer");
    expect(validateDraft(card, { answer: "я".repeat(21) })?.field).toBe("answer");
    expect(validateDraft(card, { answer: "😀".repeat(20) })).toBeNull();
    expect(validateDraft(card, { answer: "ок", care_action: "😀".repeat(11) })?.field).toBe("care_action");
  });

  test("refuses characters the server rejects", () => {
    expect(validateDraft(card, { answer: "секрет\u0000" })?.field).toBe("answer");
    expect(validateDraft(card, { answer: "обрыв\ud83d" })?.field).toBe("answer");
    expect(validateDraft(card, { answer: "пара 😀" })).toBeNull();
  });
});

describe("cardFailure", () => {
  test("sends a signed-out person to login and treats a missing space neutrally", () => {
    expect(cardFailure(401, "unauthorized").kind).toBe("login");
    expect(cardFailure(404, "not_found")).toMatchObject({ kind: "gone", text: "Пространство недоступно." });
  });

  test("asks the paywall for access_required and a reload for state conflicts", () => {
    expect(cardFailure(409, "access_required").kind).toBe("paywall");
    for (const code of ["already_closed", "already_revealed", "reveal_pending", "not_closed", "field_not_available"]) {
      expect(cardFailure(code === "field_not_available" ? 400 : 409, code).kind).toBe("reload");
    }
  });

  test("keeps the text for validation, throttling and network errors", () => {
    expect(cardFailure(400, "invalid_field")).toMatchObject({ kind: "none" });
    expect(cardFailure(429, "rate_limited").text).toMatch(/Подождите минуту/);
    expect(cardFailure(0, "network").text).toMatch(/Ничего не потеряно/);
    expect(cardFailure(500, "").text).toMatch(/Ничего не потеряно/);
    expect(cardFailure(409, "skip_not_allowed").text).toMatch(/нельзя пропустить/);
    expect(cardFailure(403, "bad_origin").text).toMatch(/Сессия устарела/);
    expect(cardFailure(400, "something_new")).toMatchObject({ kind: "none", text: expect.stringMatching(/Не получилось выполнить действие/) });
  });
});

describe("history and progress helpers", () => {
  const item = (id: string, position: number): HistoryItem => ({ id, position, title: `T${position}`, prompt: "P", outcome: "revealed", mine: null, partner: { status: "answered" } });

  test("merges pages without duplicates and keeps the newest first", () => {
    expect(mergeHistory([item("a", 3), item("b", 2)], [item("b", 2), item("c", 1)]).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  test("formats progress and the partner status without guessing gender", () => {
    expect(progressText({ done: 3, total: 29 })).toBe("3 из 29");
    expect(partnerStatusText("none", "Борис")).toBe("Борис: ответа пока нет.");
    expect(partnerStatusText("answered", "Борис")).toBe("Борис: ответ есть. Текст откроется, когда ответите вы.");
    expect(partnerStatusText("skipped", "Борис")).toBe("Борис: карточка пропущена.");
  });
});
