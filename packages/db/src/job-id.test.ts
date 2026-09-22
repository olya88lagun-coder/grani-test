import { expect, test } from "vitest";
import { jobIdFor } from "./job-id";

test("the same key gives the same uuid-shaped job id", () => {
  expect(jobIdFor("generate:r1:full")).toBe(jobIdFor("generate:r1:full"));
  expect(jobIdFor("generate:r1:full")).not.toBe(jobIdFor("generate:r1:friends"));
  expect(jobIdFor("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});
