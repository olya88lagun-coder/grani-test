import { describe, expect, test } from "vitest";
import { repeatsAny } from "./chapter-overlap";

const TIP = "Простая система из двух правил — фиксированная сумма на накопления и свободная сумма на всё остальное, без подробного учёта каждой покупки.";

describe("repeatsAny", () => {
  test("sees a library tip that was only reworded with another case and a verb", () => {
    expect(repeatsAny("Внедри простую систему из двух правил: фиксированная сумма на накопления и свободная сумма на всё остальное, без подробного учёта каждой покупки.", [TIP])).toBe(true);
  });

  test("sees a tip repeated between two cards even with a different opening", () => {
    const first = "Заранее определи сумму, которой можешь помогать без ущерба для себя, и держись её.";
    const second = "Заранее определи сумму, которой можешь делиться без ущерба для себя, и придерживайся этого правила.";

    expect(repeatsAny(second, [first])).toBe(true);
  });

  test("does not touch different advice on a similar topic or a short phrase", () => {
    expect(repeatsAny("Перед следующим переводом другу назови вслух сумму и срок возврата и запиши их в заметку.", [TIP])).toBe(false);
    expect(repeatsAny("Подожди сутки.", ["Подожди сутки."])).toBe(false);
    expect(repeatsAny("Любой текст здесь достаточно длинный для сравнения слов.", [])).toBe(false);
  });

  test("е and ё are the same letter", () => {
    expect(repeatsAny("Всё остальное можно тратить свободно без подробного учёта каждой покупки вообще", ["Все остальное можно тратить свободно без подробного учета каждой покупки вообще"])).toBe(true);
  });
});
