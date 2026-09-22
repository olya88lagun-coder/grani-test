import { expect, test } from "vitest";
import { friendAnsweredText, pairCreatedText } from "./texts";

const URL = "https://grani-test.ru/result/1";

test("friend answers count up to three, then announce the comparison", () => {
  expect(friendAnsweredText(1, URL)).toBe(`Ещё один друг ответил на вопросы о тебе — 1 из 3. Когда ответят трое, откроется сравнение «Как тебя видят другие»: ${URL}`);
  expect(friendAnsweredText(2, URL)).toContain("2 из 3");
  expect(friendAnsweredText(3, URL)).toBe(`Ответили трое друзей — сравнение «Как тебя видят другие» готово: ${URL}`);
  expect(friendAnsweredText(4, URL)).toBe(`Ответил ещё один друг, сравнение обновилось. Всего ответов: 4. ${URL}`);
});

test("a created pair names the partner and the score", () => {
  expect(pairCreatedText("Борис", 78, "https://grani-test.ru/pair/9")).toBe(
    "Пара готова: вы и Борис, совместимость 78%. Посмотреть типы и шкалы рядом: https://grani-test.ru/pair/9",
  );
});
