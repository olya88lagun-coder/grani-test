import { describe, expect, test } from "vitest";
import { clientKeyFromHeaders, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit within a window and resets after it", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  test("takes the first forwarded address", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "10.0.0.1, 172.16.0.1" }))).toBe("10.0.0.1");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
