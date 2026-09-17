import { describe, expect, test } from "vitest";
import { scoreItems, TRAITS, type Answers, type Trait } from "@grani/core";
import { FRIEND_ITEMS, friendItemText, NAME_PLACEHOLDER, SELF_ITEMS } from "./items";

// Ключи IPIP-50 из https://ipip.ori.org/new_IPIP-50-item-scale.htm, вопросы 1..50.
// E — extraversion, A — agreeableness, C — conscientiousness, S — stability, O — openness.
const IPIP_KEYS = [
  "E+ A- C+ S- O+",
  "E- A+ C- S+ O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S+ O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S- O-",
  "E+ A- C+ S- O+",
  "E- A+ C- S- O+",
  "E+ A+ C+ S- O+",
  "E- A+ C+ S- O+",
]
  .join(" ")
  .split(" ");

const LETTER_TO_TRAIT: Record<string, Trait> = {
  E: "extraversion",
  A: "agreeableness",
  C: "conscientiousness",
  S: "stability",
  O: "openness",
};

describe("SELF_ITEMS", () => {
  test("has 50 items numbered 1..50 with ids ipip-01..ipip-50", () => {
    expect(SELF_ITEMS.map((item) => item.number)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(SELF_ITEMS.map((item) => item.id)).toEqual(
      Array.from({ length: 50 }, (_, i) => `ipip-${String(i + 1).padStart(2, "0")}`),
    );
  });

  test("matches the IPIP-50 trait and key of every item", () => {
    const actual = SELF_ITEMS.map((item) => {
      const letter = Object.entries(LETTER_TO_TRAIT).find(([, trait]) => trait === item.trait)?.[0];
      return `${letter}${item.reversed ? "-" : "+"}`;
    });

    expect(actual).toEqual(IPIP_KEYS);
  });

  test("has ten items per trait", () => {
    for (const trait of TRAITS) expect(SELF_ITEMS.filter((item) => item.trait === trait)).toHaveLength(10);
  });

  test("has a Russian text and the English source for every item", () => {
    for (const item of SELF_ITEMS) {
      expect(item.text).toMatch(/[а-яё]/i);
      expect(item.source).toMatch(/^[A-Z][a-zA-Z' ]+$/);
    }
  });

  test("does not use bracketed gender endings like (а)", () => {
    for (const item of [...SELF_ITEMS, ...FRIEND_ITEMS]) expect(item.text).not.toContain("(а)");
  });
});

describe("FRIEND_ITEMS", () => {
  test("has four items per trait, two direct and two reversed", () => {
    for (const trait of TRAITS) {
      const items = FRIEND_ITEMS.filter((item) => item.trait === trait);
      expect(items).toHaveLength(4);
      expect(items.filter((item) => item.reversed)).toHaveLength(2);
    }
  });

  test("reuses self item ids with the same trait and key", () => {
    for (const friendItem of FRIEND_ITEMS) {
      const selfItem = SELF_ITEMS.find((item) => item.id === friendItem.id);
      expect(selfItem, friendItem.id).toBeDefined();
      expect(friendItem.trait).toBe(selfItem?.trait);
      expect(friendItem.reversed).toBe(selfItem?.reversed);
    }
    expect(new Set(FRIEND_ITEMS.map((item) => item.id)).size).toBe(20);
  });

  test("puts the name placeholder into every friend text exactly once", () => {
    for (const item of FRIEND_ITEMS) expect(item.text.split(NAME_PLACEHOLDER)).toHaveLength(2);
  });

  test("lets owner answers be scored on the friend subset", () => {
    const ownerAnswers: Answers = Object.fromEntries(SELF_ITEMS.map((item) => [item.id, 5]));

    const subset = scoreItems(FRIEND_ITEMS, ownerAnswers);

    for (const trait of TRAITS) expect(subset[trait]).toBe(50);
  });
});

describe("friendItemText", () => {
  test("substitutes the name", () => {
    const item = FRIEND_ITEMS.find((candidate) => candidate.id === "ipip-21");

    expect(item && friendItemText(item, "Аня")).toBe("Аня легко начинает разговор.");
  });
});
