import { describe, expect, test } from "vitest";
import { TRAITS } from "./traits";

describe("TRAITS", () => {
  test("lists the five Big Five traits in the canonical order used by type codes", () => {
    expect(TRAITS).toEqual(["openness", "conscientiousness", "extraversion", "agreeableness", "stability"]);
  });
});
