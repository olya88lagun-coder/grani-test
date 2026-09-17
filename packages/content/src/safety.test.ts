import { describe, expect, test } from "vitest";
import { findStopWords } from "./safety";

describe("findStopWords", () => {
  test.each([
    ["Похоже, у тебя депрессия.", "diagnosis"],
    ["Это признаки расстройства личности.", "diagnosis"],
    ["Такой профиль бывает при СДВГ.", "diagnosis"],
    ["Тебе стоит поставить себе диагноз.", "diagnosis"],
    ["Попробуй антидепрессанты.", "medication"],
    ["Выпей успокоительные таблетки.", "medication"],
    ["Это лечится лекарствами.", "medication"],
    ["Мысли о суициде нормальны.", "self_harm"],
    ["Иногда хочется навредить себе.", "self_harm"],
    ["Твоя внешность отталкивает людей.", "appearance"],
    ["Сбрось лишний вес, и станет легче.", "appearance"],
  ] as const)("flags %j as %s", (text, topic) => {
    expect(findStopWords(text)).toContain(topic);
  });

  test.each([
    "Ты любишь порядок и держишь слово.",
    "Тебе важно, чтобы рядом было спокойно.",
    "В конфликте ты сначала слушаешь, а потом отвечаешь.",
    "Когда накапливается усталость, помогает пауза и прогулка.",
    "Вы по-разному отдыхаете, и это можно обсудить заранее.",
    "У вас общие увлечения, и это сближает.",
  ])("does not flag %j", (text) => {
    expect(findStopWords(text)).toEqual([]);
  });

  test("is case-insensitive and reports each topic once", () => {
    expect(findStopWords("ДИАГНОЗ и снова диагноз, а ещё Таблетки")).toEqual(["diagnosis", "medication"]);
  });
});
