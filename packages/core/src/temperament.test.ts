import { describe, expect, test } from "vitest";
import { temperamentFromBigFive } from "./temperament";
import type { TraitScores } from "./traits";

const base: TraitScores = { openness: 50, conscientiousness: 50, agreeableness: 50, extraversion: 50, stability: 50 };
const with_ = (extraversion: number, stability: number): TraitScores => ({ ...base, extraversion, stability });

describe("temperamentFromBigFive", () => {
  test("maps the four quadrants of extraversion and stability", () => {
    expect(temperamentFromBigFive(with_(80, 80))).toBe("sanguine");
    expect(temperamentFromBigFive(with_(80, 20))).toBe("choleric");
    expect(temperamentFromBigFive(with_(20, 80))).toBe("phlegmatic");
    expect(temperamentFromBigFive(with_(20, 20))).toBe("melancholic");
  });

  // Эмоциональность = 100 − стабильность; 50 считается высокой, как в тесте темперамента
  test("scores of exactly 50 give choleric, like the temperament test", () => {
    expect(temperamentFromBigFive(with_(50, 50))).toBe("choleric");
  });
});
