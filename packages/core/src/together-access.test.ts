import { describe, expect, test } from "vitest";
import {
  accessState,
  canRenew,
  isTogetherProduct,
  nextPeriod,
  providedPaidSeconds,
  stageOf,
  TOGETHER_PERIOD_MS,
  unusedPaidMs,
  type AccessPeriod,
} from "./together-access";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DAY_SECONDS = 86_400;
const period = (start: string, end: string): AccessPeriod => ({ startsAt: at(start), endsAt: at(end) });
const OCTOBER = period("2026-10-01", "2026-10-31");

describe("nextPeriod", () => {
  test("starts at the payment time when nothing was paid before", () => {
    expect(nextPeriod([], at("2026-10-01"))).toEqual(OCTOBER);
  });

  test("an early payment starts when the current access ends", () => {
    expect(nextPeriod([OCTOBER], at("2026-10-20"))).toEqual(period("2026-10-31", "2026-11-30"));
  });

  test("a late payment starts at the payment time and leaves the gap unpaid", () => {
    expect(nextPeriod([OCTOBER], at("2026-11-10"))).toEqual(period("2026-11-10", "2026-12-10"));
  });
});

describe("providedPaidSeconds", () => {
  test("counts only the part of a period that has already passed", () => {
    expect(providedPaidSeconds([OCTOBER], at("2026-10-11"))).toBe(10 * DAY_SECONDS);
    expect(providedPaidSeconds([OCTOBER], at("2026-12-01"))).toBe(30 * DAY_SECONDS);
    expect(providedPaidSeconds([OCTOBER], at("2026-09-01"))).toBe(0);
  });

  test("does not count a gap between periods", () => {
    const periods = [OCTOBER, period("2026-11-10", "2026-12-10")];

    expect(providedPaidSeconds(periods, at("2026-12-31"))).toBe(60 * DAY_SECONDS);
  });

  test("does not count overlapping time twice", () => {
    const periods = [OCTOBER, period("2026-10-20", "2026-11-19")];

    expect(providedPaidSeconds(periods, at("2026-11-30"))).toBe(49 * DAY_SECONDS);
  });

  test("a closed space stops providing time at the closing moment", () => {
    expect(providedPaidSeconds([OCTOBER], at("2026-11-30"), at("2026-10-11"))).toBe(10 * DAY_SECONDS);
  });
});

describe("stageOf", () => {
  test("rounds down to whole 30-day periods and stops at twelve", () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(30 * DAY_SECONDS - 1)).toBe(0);
    expect(stageOf(30 * DAY_SECONDS)).toBe(1);
    expect(stageOf(90 * DAY_SECONDS)).toBe(3);
    expect(stageOf(10_000 * DAY_SECONDS)).toBe(12);
  });
});

describe("accessState", () => {
  test("is active inside a period and inactive exactly at its end", () => {
    expect(accessState([OCTOBER], at("2026-10-15")).active).toBe(true);
    expect(accessState([OCTOBER], at("2026-10-31")).active).toBe(false);
  });

  test("reports the end of paid access and the time left", () => {
    expect(accessState([OCTOBER], at("2026-10-21"))).toEqual({ active: true, accessUntil: at("2026-10-31"), remainingMs: 10 * DAY_SECONDS * 1000 });
  });

  test("has no access and no end date before the first payment", () => {
    expect(accessState([], at("2026-10-01"))).toEqual({ active: false, accessUntil: null, remainingMs: 0 });
  });

  test("a closed space has no access and ends at the closing moment", () => {
    expect(accessState([OCTOBER], at("2026-10-15"), at("2026-10-11"))).toEqual({ active: false, accessUntil: at("2026-10-11"), remainingMs: 0 });
  });
});

describe("canRenew", () => {
  test("allows the first payment", () => {
    expect(canRenew([], at("2026-10-01"))).toBe(true);
  });

  test("allows renewal while 30 days or less of access remain", () => {
    expect(canRenew([OCTOBER], at("2026-10-01"))).toBe(true);
    expect(canRenew([OCTOBER], at("2026-10-25"))).toBe(true);
  });

  test("refuses when more than 30 days are already paid ahead", () => {
    expect(canRenew([OCTOBER], new Date(at("2026-10-01").getTime() - 1))).toBe(false);
    expect(canRenew([OCTOBER, period("2026-10-31", "2026-11-30")], at("2026-10-15"))).toBe(false);
    expect(TOGETHER_PERIOD_MS).toBe(30 * DAY_SECONDS * 1000);
  });

  test("refuses for a closed space", () => {
    expect(canRenew([], at("2026-10-01"), at("2026-10-01"))).toBe(false);
  });
});

describe("unusedPaidMs", () => {
  test("is the paid time left after the closing moment", () => {
    expect(unusedPaidMs([OCTOBER], at("2026-10-21"))).toBe(10 * DAY_SECONDS * 1000);
    expect(unusedPaidMs([OCTOBER], at("2026-09-01"))).toBe(30 * DAY_SECONDS * 1000);
    expect(unusedPaidMs([OCTOBER], at("2026-11-15"))).toBe(0);
  });

  test("does not count overlapping time twice", () => {
    expect(unusedPaidMs([OCTOBER, period("2026-10-20", "2026-11-19")], at("2026-10-31"))).toBe(19 * DAY_SECONDS * 1000);
  });
});

describe("isTogetherProduct", () => {
  test("recognizes only the together product", () => {
    expect(isTogetherProduct("together_30d")).toBe(true);
    expect(isTogetherProduct("full")).toBe(false);
    expect(isTogetherProduct(undefined)).toBe(false);
  });
});
