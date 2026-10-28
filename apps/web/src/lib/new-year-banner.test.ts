import { describe, expect, test } from "vitest";
import { isNewYearBannerActive } from "./new-year-banner";

describe("new year banner window", () => {
  test("is shown before and during the holidays", () => {
    expect(isNewYearBannerActive(new Date("2026-10-28T12:00:00+03:00"))).toBe(true);
    expect(isNewYearBannerActive(new Date("2026-12-31T23:30:00+03:00"))).toBe(true);
    expect(isNewYearBannerActive(new Date("2027-01-15T23:59:59+03:00"))).toBe(true);
  });
  test("hides itself at the end of 15 January 2027, Moscow time", () => {
    expect(isNewYearBannerActive(new Date("2027-01-16T00:00:00+03:00"))).toBe(false);
    expect(isNewYearBannerActive(new Date("2027-03-01T12:00:00+03:00"))).toBe(false);
  });
  test("an invalid date never hides the banner by accident of NaN math", () => {
    expect(isNewYearBannerActive(new Date("not a date"))).toBe(true);
  });
});
