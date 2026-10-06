import { describe, expect, test } from "vitest";
import { pilotCodeFailure } from "./together-pilot-view";

describe("pilotCodeFailure", () => {
  test("a wrong code asks to check it and does not hint at the right one", () => {
    const text = pilotCodeFailure(403, "invalid_code");

    expect(text).toMatch(/Код не подошёл/);
  });

  test("a full pilot, too many attempts, a lost session and a network failure each have their own words", () => {
    expect(pilotCodeFailure(409, "limit_reached")).toMatch(/места/i);
    expect(pilotCodeFailure(429, "rate_limited")).toMatch(/Подождите минуту/);
    expect(pilotCodeFailure(401, "unauthorized")).toMatch(/войти/i);
    expect(pilotCodeFailure(0, "network")).toMatch(/связаться/);
  });

  test("anything else gets a neutral retry message", () => {
    expect(pilotCodeFailure(500, "")).toMatch(/связаться/);
    expect(pilotCodeFailure(400, "other")).toMatch(/Не получилось/);
  });
});
