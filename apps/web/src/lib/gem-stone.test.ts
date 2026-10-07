import { describe, expect, test } from "vitest";
import type { TypeShape } from "./gem-paths";
import { GEM_FAMILIES, gemStone } from "./gem-stone";

const SHAPES: readonly TypeShape[] = ["diamond", "hexagon", "triangle", "circle", "star", "square", "pentagon", "drop"];
const RGB = /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/;

describe("gemStone", () => {
  test("returns an outline and facets for every shape and family", () => {
    for (const shape of SHAPES) {
      for (const family of GEM_FAMILIES) {
        const gem = gemStone(shape, family);
        expect(gem.outline.split(" ").length).toBeGreaterThanOrEqual(3);
        expect(gem.facets.length).toBeGreaterThan(6);
      }
    }
  });

  test("is deterministic: the same input gives the same stone", () => {
    expect(gemStone("hexagon", 2)).toEqual(gemStone("hexagon", 2));
  });

  test("paints facets with valid rgb colors", () => {
    const { facets } = gemStone("star", 1);
    for (const facet of facets) expect(facet.fill).toMatch(RGB);
  });

  test("different families use different colors for the same shape", () => {
    const fills = (family: 1 | 2 | 3 | 4) => gemStone("pentagon", family).facets.map((f) => f.fill);
    expect(fills(1)).not.toEqual(fills(2));
    expect(fills(3)).not.toEqual(fills(4));
  });

  test("brilliant cuts have three facets per side plus a table; the step cut has 25", () => {
    expect(gemStone("hexagon", 1).facets).toHaveLength(6 * 3 + 1);
    expect(gemStone("square", 1).facets).toHaveLength(8 * 3 + 1);
  });

  test("keeps every point inside the 200 by 200 viewBox", () => {
    for (const shape of SHAPES) {
      const numbers = gemStone(shape, 3).outline.split(/[ ,]/).map(Number);
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(200);
      }
    }
  });
});
