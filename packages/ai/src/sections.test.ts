import { describe, expect, test } from "vitest";
import { parseChapterCards, parseLifeCards, parseSections, sectionStrings } from "./sections";

const long = (n: number) => "а".repeat(n);
const situation = (seed: string) => ({ seed, title: long(30), scene: long(100), why: long(100), traits: ["agreeableness"], say: [long(20)], do: long(60) });
const cards = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  headline: long(60),
  summary: long(200),
  situations: ["sa", "sb", "sc", "sd", "se", "sf"].map(situation),
  others_see: long(150),
  traps: [1, 2, 3].map(() => ({ trap: long(30), instead: long(30) })),
  ...overrides,
});

describe("parseSections", () => {
  test("accepts a complete full report", () => {
    const sections = {
      portrait: long(400),
      strengths: [long(30), long(30), long(30), long(30)],
      blind_spots: [1, 2, 3].map(() => ({ text: long(30), tip: long(30) })),
      manual: { work: [long(20), long(20), long(20)], fight: [long(20), long(20), long(20)], annoys: [long(20), long(20), long(20)] },
    };

    expect(parseSections("full", sections)).toEqual(sections);
  });

  test("rejects missing sections, extra keys and wrong lengths", () => {
    expect(parseSections("friends", {})).toBeNull();
    expect(parseSections("friends", { text: long(300), extra: "x" })).toBeNull();
    expect(parseSections("friends", { text: long(50) })).toBeNull();
    expect(parseSections("chapter_money", { text: long(500), tips: [long(30)] })).toBeNull();
  });

  test("accepts a cards chapter and still accepts the text chapter", () => {
    const text = { text: long(500), tips: [long(30), long(30), long(30)] };

    expect(parseSections("chapter_money", cards())).toEqual(cards());
    expect(parseSections("chapter_money", text)).toEqual(text);
  });

  test("rejects cards with wrong counts, unknown traits, extra keys and a wrong version", () => {
    expect(parseSections("chapter_money", cards({ situations: cards().situations.slice(0, 4) }))).toBeNull();
    expect(parseSections("chapter_money", cards({ traps: cards().traps.slice(0, 2) }))).toBeNull();
    expect(parseSections("chapter_money", cards({ version: 3 }))).toBeNull();
    expect(parseSections("chapter_money", cards({ extra: "x" }))).toBeNull();
    const badTrait = cards();
    badTrait.situations[0] = { ...badTrait.situations[0]!, traits: ["luck"] };
    expect(parseSections("chapter_money", badTrait)).toBeNull();
  });

  test("a text chapter cannot carry the version marker", () => {
    expect(parseSections("chapter_money", { version: 2, text: long(500), tips: [long(30), long(30), long(30)] })).toBeNull();
  });
});

test("parseChapterCards returns the typed value or null", () => {
  expect(parseChapterCards(cards())?.situations).toHaveLength(6);
  expect(parseChapterCards({ text: long(500), tips: [long(30), long(30), long(30)] })).toBeNull();
});

test("sectionStrings collects every text for the stop-word check", () => {
  expect(sectionStrings({ a: "x", b: ["y", { c: "z" }], d: 3 })).toEqual(["x", "y", "z"]);
});

describe("parseLifeCards", () => {
  const life = (overrides: Record<string, unknown> = {}) => ({ version: 1, situations: ["sa", "sb", "sc", "sd", "se"].map(situation), ...overrides });

  test("accepts five cards of version 1", () => {
    expect(parseLifeCards(life())?.situations).toHaveLength(5);
  });

  test("rejects four or six cards, another version, extra fields and a chapter-style object", () => {
    expect(parseLifeCards(life({ situations: ["sa", "sb", "sc", "sd"].map(situation) }))).toBeNull();
    expect(parseLifeCards(life({ situations: ["sa", "sb", "sc", "sd", "se", "sf"].map(situation) }))).toBeNull();
    expect(parseLifeCards(life({ version: 2 }))).toBeNull();
    expect(parseLifeCards(life({ headline: long(60) }))).toBeNull();
    expect(parseLifeCards(cards())).toBeNull();
    expect(parseLifeCards(null)).toBeNull();
  });
});
