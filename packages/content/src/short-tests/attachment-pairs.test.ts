import { combinationKey } from "@grani/core";
import { describe, expect, test } from "vitest";
import { findStopWords } from "../safety";
import { ATTACHMENT_COMBINATIONS, getCombination, getShortTest } from "./index";

const attachment = getShortTest("attachment")!;
const order = attachment.types.map((type) => type.key);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("attachment pair combinations", () => {
  test("cover all ten combinations of the four types", () => {
    const expected = new Set(order.flatMap((a) => order.map((b) => combinationKey(order, a, b))));
    expect(ATTACHMENT_COMBINATIONS.map((c) => c.key).sort()).toEqual([...expected].sort());
  });

  test("are found whatever the order of the partners", () => {
    expect(getCombination("attachment", "avoidant", "anxious")).toEqual(getCombination("attachment", "anxious", "avoidant"));
    expect(getCombination("attachment", "secure", "secure")?.key).toBe("secure+secure");
    expect(getCombination("temperament", "sangvinik", "kholerik")).toBeNull();
  });

  test("each has a name, one phrase and a 120–200 word text", () => {
    for (const combination of ATTACHMENT_COMBINATIONS) {
      expect(combination.name, combination.key).toBeTruthy();
      expect(combination.phrase, combination.key).toBeTruthy();
      expect(words(combination.text), combination.key).toBeGreaterThanOrEqual(120);
      expect(words(combination.text), combination.key).toBeLessThanOrEqual(200);
    }
  });

  test("have no stop words", () => {
    const texts = ATTACHMENT_COMBINATIONS.flatMap((c) => [c.name, c.phrase, c.text]);
    expect(texts.filter((text) => findStopWords(text).length > 0)).toEqual([]);
  });

  test("only the attachment test offers a pair mode", () => {
    expect(attachment.pairOffer?.preview.length).toBeGreaterThan(0);
    expect(getShortTest("temperament")!.pairOffer).toBeUndefined();
  });
});
