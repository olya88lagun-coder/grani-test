import { describe, expect, test } from "vitest";
import { PAIR_PRODUCTS, PAIR_PRODUCTS_CHOICE } from "./pair-products";

const texts = () => Object.values(PAIR_PRODUCTS).flatMap((product) => [product.title, product.summary, product.needsTest, product.period]);

describe("pair products explainer", () => {
  test("keeps prices out of the shared text so pages cannot disagree with PRODUCT_PRICES", () => {
    for (const text of [...texts(), PAIR_PRODUCTS_CHOICE]) {
      expect(text).not.toMatch(/₽|руб|\d{3}/);
    }
  });

  test("says the test is needed for one product and not for the other", () => {
    expect(PAIR_PRODUCTS.compatibility.needsTest).toMatch(/нужен/);
    expect(PAIR_PRODUCTS.together.needsTest).toMatch(/не нужен/);
  });

  test("links each product to its own page and tells them apart", () => {
    expect(PAIR_PRODUCTS.compatibility.href).toBe("/compatibility");
    expect(PAIR_PRODUCTS.together.href).toBe("/together");
    expect(PAIR_PRODUCTS.compatibility.summary).not.toBe(PAIR_PRODUCTS.together.summary);
  });
});
