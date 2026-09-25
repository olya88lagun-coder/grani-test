import { ALL_TYPE_CODES } from "@grani/core";
import { TYPE_DIRS, typeCodeToDir } from "@grani/content";
import { describe, expect, test } from "vitest";
import { TYPE_VISUALS, contrastRatio, dirToTypeCode, gemPaths } from "./type-visuals";

describe("TYPE_VISUALS", () => {
  test("has a visual for every type and nothing else", () => {
    expect(Object.keys(TYPE_VISUALS).sort()).toEqual([...TYPE_DIRS].sort());
  });

  test("family follows openness and conscientiousness", () => {
    expect(TYPE_VISUALS.pppm?.family).toBe(1);
    expect(TYPE_VISUALS.pmmp?.family).toBe(2);
    expect(TYPE_VISUALS.mppm?.family).toBe(3);
    expect(TYPE_VISUALS.mmmm?.family).toBe(4);
  });

  test("shapes do not repeat inside a family, so every type is recognizable", () => {
    for (const family of [1, 2, 3, 4] as const) {
      const shapes = Object.values(TYPE_VISUALS).filter((visual) => visual.family === family).map((visual) => visual.shape);
      expect(new Set(shapes).size).toBe(shapes.length);
    }
  });
});

describe("contrastRatio", () => {
  test("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });
});

describe("dirToTypeCode", () => {
  test("is the inverse of typeCodeToDir", () => {
    for (const code of ALL_TYPE_CODES) expect(dirToTypeCode(typeCodeToDir(code))).toBe(code);
  });

  test.each(["", "ppp", "ppppp", "pxpp", "PPPP", "../x"])("rejects %j", (dir) => {
    expect(dirToTypeCode(dir)).toBeNull();
  });
});

test("every shape has a closed outline and facet lines", () => {
  for (const visual of Object.values(TYPE_VISUALS)) {
    const { outline, facets } = gemPaths(visual.shape, 100);
    expect(outline).toMatch(/^M.*Z$/);
    expect(facets).toMatch(/^M/);
  }
});
