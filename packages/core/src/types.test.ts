import { describe, expect, test } from "vitest";
import type { TraitScores } from "./traits";
import {
  ALL_TYPE_CODES,
  isBorderline,
  stabilityOf,
  TYPE_NAMES,
  traitLevel,
  typeCodeOf,
  typeName,
} from "./types";

function scores(overrides: Partial<Record<keyof TraitScores, number>> = {}): TraitScores {
  return { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50, ...overrides };
}

describe("typeCodeOf", () => {
  test("orders poles as openness, conscientiousness, extraversion, agreeableness", () => {
    const code = typeCodeOf(scores({ openness: 80, conscientiousness: 20, extraversion: 70, agreeableness: 10 }));

    expect(code).toBe("+-+-");
  });

  test("treats 50 as the high pole and 49 as the low pole", () => {
    expect(typeCodeOf(scores({ openness: 50, conscientiousness: 49, extraversion: 50, agreeableness: 49 }))).toBe("+-+-");
  });

  test("ignores stability", () => {
    expect(typeCodeOf(scores({ stability: 0 }))).toBe(typeCodeOf(scores({ stability: 100 })));
  });
});

describe("stabilityOf", () => {
  test("is calm from 50 and sensitive below 50", () => {
    expect(stabilityOf(scores({ stability: 50 }))).toBe("calm");
    expect(stabilityOf(scores({ stability: 49 }))).toBe("sensitive");
  });
});

describe("isBorderline", () => {
  test.each([
    [44, false],
    [45, true],
    [50, true],
    [55, true],
    [56, false],
  ] as const)("%i → %s", (score, expected) => {
    expect(isBorderline(score)).toBe(expected);
  });
});

describe("traitLevel", () => {
  test.each([
    [0, "low"],
    [44, "low"],
    [45, "borderline"],
    [55, "borderline"],
    [56, "high"],
    [100, "high"],
  ] as const)("%i → %s", (score, expected) => {
    expect(traitLevel(score)).toBe(expected);
  });
});

describe("type names", () => {
  test("has exactly 16 distinct codes, each with a name", () => {
    expect(new Set(ALL_TYPE_CODES).size).toBe(16);
    for (const code of ALL_TYPE_CODES) expect(TYPE_NAMES[code].name.length).toBeGreaterThan(0);
    expect(Object.keys(TYPE_NAMES).sort()).toEqual([...ALL_TYPE_CODES].sort());
  });

  test("maps the spec examples", () => {
    expect(TYPE_NAMES["+-++"].name).toBe("Искра");
    expect(TYPE_NAMES["-+-+"].name).toBe("Тихий хранитель");
  });

  test("uses the feminine form for female users when it exists", () => {
    expect(typeName("+--+", "female")).toBe("Мечтательница");
    expect(typeName("+--+", "male")).toBe("Мечтатель");
    expect(typeName("+--+", null)).toBe("Мечтатель");
  });

  test("falls back to the base name when there is no feminine form", () => {
    expect(typeName("+-++", "female")).toBe("Искра");
  });
});
