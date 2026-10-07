import { describe, expect, test } from "vitest";
import { LOGIN_INTRO, pickLoginContext } from "./login-context";

const NONE = { pairInvite: false, together: false, pendingResult: false };

describe("pickLoginContext", () => {
  test("is the plain entrance when nothing is confirmed", () => {
    expect(pickLoginContext(NONE)).toBe("default");
  });

  test("a confirmed pending result gives the result intro", () => {
    expect(pickLoginContext({ ...NONE, pendingResult: true })).toBe("result");
  });

  test("follows the same priority as the return after sign-in: pair invite, then Together, then the result", () => {
    expect(pickLoginContext({ pairInvite: true, together: true, pendingResult: true })).toBe("pair");
    expect(pickLoginContext({ pairInvite: false, together: true, pendingResult: true })).toBe("together");
    expect(pickLoginContext({ pairInvite: true, together: false, pendingResult: true })).toBe("pair");
    expect(pickLoginContext({ pairInvite: false, together: true, pendingResult: false })).toBe("together");
  });
});

describe("LOGIN_INTRO", () => {
  test("has the approved intro for each context", () => {
    expect(LOGIN_INTRO.default).toEqual({ title: "Войди в «Грани»", lead: "Здесь можно вернуться к своему результату и продолжить знакомство с собой" });
    expect(LOGIN_INTRO.result).toEqual({ title: "Осталось увидеть результат", lead: "Войди, чтобы увидеть свой тип личности и пять ключевых черт" });
    expect(LOGIN_INTRO.pair).toEqual({ title: "Продолжим сравнение", lead: "Войди, чтобы продолжить сравнение ваших результатов" });
    expect(LOGIN_INTRO.together).toEqual({ title: "Продолжим во «Вдвоём»", lead: "Войди, чтобы продолжить в пространстве «Грани. Вдвоём»" });
  });

  test("never promises a ready result or saved answers", () => {
    for (const [context, intro] of Object.entries(LOGIN_INTRO)) {
      expect(`${intro.title} ${intro.lead}`, context).not.toMatch(/результат (готов|посчитан)|ответы сохранены|сохранён/i);
    }
  });
});
