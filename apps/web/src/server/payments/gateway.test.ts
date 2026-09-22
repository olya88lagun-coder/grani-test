import { expect, test } from "vitest";
import { kopecksToValue, valueToKopecks } from "./gateway";

test("converts kopecks to the API amount and back", () => {
  expect(kopecksToValue(29900)).toBe("299.00");
  expect(kopecksToValue(9950)).toBe("99.50");
  expect(valueToKopecks("299.00")).toBe(29900);
  expect(valueToKopecks("99.5")).toBe(9950);
  expect(valueToKopecks("abc")).toBeNull();
  expect(valueToKopecks(299)).toBeNull();
});
