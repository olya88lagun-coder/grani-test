import { describe, expect, test } from "vitest";
import { CHAPTER_PRODUCTS, formatRub, isProduct, PRODUCT_PRICES } from "./pricing";

const NBSP = " ";

describe("PRODUCT_PRICES", () => {
  test("matches the prices agreed in the spec", () => {
    expect(PRODUCT_PRICES).toEqual({
      full: 29900,
      chapter_money: 9900,
      chapter_conflict: 9900,
      chapter_stress: 9900,
      chapter_relationships: 9900,
      chapters_all: 24900,
      pair: 39900,
    });
  });

  test("makes all chapters cheaper than buying them one by one", () => {
    const separately = CHAPTER_PRODUCTS.reduce((total, product) => total + PRODUCT_PRICES[product], 0);

    expect(PRODUCT_PRICES.chapters_all).toBeLessThan(separately);
  });
});

describe("isProduct", () => {
  test.each(["full", "pair", "chapters_all", "chapter_stress"])("accepts %s", (value) => {
    expect(isProduct(value)).toBe(true);
  });

  test.each(["", "FULL", "chapter", "toString", 42, null, undefined])("rejects %j", (value) => {
    expect(isProduct(value)).toBe(false);
  });
});

describe("formatRub", () => {
  test("formats whole rubles with a non-breaking space before the sign", () => {
    expect(formatRub(29900)).toBe(`299${NBSP}₽`);
    expect(formatRub(39900)).toBe(`399${NBSP}₽`);
  });

  test("groups thousands with non-breaking spaces", () => {
    expect(formatRub(15000000)).toBe(`150${NBSP}000${NBSP}₽`);
  });

  test.each([29950, -100, 1.5])("rejects %d kopecks", (kopecks) => {
    expect(() => formatRub(kopecks)).toThrow();
  });
});
