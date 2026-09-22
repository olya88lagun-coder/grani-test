import { expect, test } from "vitest";
import { chaptersReadyText, friendAnsweredText, pairCreatedText, reportReadyText } from "./texts";

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

test("a ready report names what is ready without gender endings", () => {
  expect(reportReadyText("full", "https://grani-test.ru/report/1")).toBe("Готово: полный разбор. Открыть: https://grani-test.ru/report/1");
  expect(reportReadyText("chapter_money", "u")).toBe("Готово: глава «Деньги». Открыть: u");
  expect(reportReadyText("friends", "u")).toBe("Готово: раздел «Как тебя видят другие». Открыть: u");
  expect(reportReadyText("pair", "u")).toBe("Готово: разбор вашей пары. Открыть: u");
});

test("the chapter bundle has its own message", () => {
  expect(chaptersReadyText("u")).toBe("Готово: все четыре главы. Открыть: u");
});
