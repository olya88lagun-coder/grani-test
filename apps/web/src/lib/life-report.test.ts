import { lifeSeeds } from "@grani/content";
import { sampleSituation } from "@grani/ai/testing";
import { describe, expect, test } from "vitest";
import { parseLifeReport } from "./life-report";

const valid = { version: 1, situations: lifeSeeds().map(sampleSituation) };

describe("parseLifeReport", () => {
  test("returns the cards of a valid report", () => {
    expect(parseLifeReport({ sections: valid })?.situations).toHaveLength(5);
  });

  test("a missing, damaged or outdated report counts as no report", () => {
    expect(parseLifeReport(null)).toBeNull();
    expect(parseLifeReport(undefined)).toBeNull();
    expect(parseLifeReport({ sections: {} })).toBeNull();
    expect(parseLifeReport({ sections: { ...valid, version: 2 } })).toBeNull();
    expect(parseLifeReport({ sections: { ...valid, situations: valid.situations.slice(0, 4) } })).toBeNull();
    expect(parseLifeReport({ sections: "мусор" })).toBeNull();
  });
});
