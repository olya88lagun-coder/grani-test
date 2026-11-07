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

  // Стабильность 50 в Big Five — «спокойствие» (stabilityOf), поэтому темперамент на этой границе не может быть эмоциональным
  test("stability of exactly 50 is calm, like the Big Five stability tag", () => {
    expect(temperamentFromBigFive(with_(50, 50))).toBe("sanguine");
    expect(temperamentFromBigFive(with_(49, 50))).toBe("phlegmatic");
    expect(temperamentFromBigFive(with_(50, 49))).toBe("choleric");
  });
});
