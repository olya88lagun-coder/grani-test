import { parsePortrait } from "@grani/ai";
import { samplePortrait } from "@grani/ai/testing";
import { portraitSeeds } from "@grani/content";
import { describe, expect, test } from "vitest";
import { parsePortraitReport } from "./portrait-report";

const valid = { version: 1, headline: samplePortrait().headline, blocks: samplePortrait().blocks.map((block, index) => ({ ...block, title: portraitSeeds()[index]!.title })) };

describe("parsePortraitReport", () => {
  test("returns the blocks of a valid report", () => {
    expect(parsePortraitReport({ sections: valid })?.blocks).toHaveLength(5);
    expect(parsePortrait(valid)).not.toBeNull();
  });

  test("a missing, damaged or outdated report counts as no report", () => {
    expect(parsePortraitReport(null)).toBeNull();
    expect(parsePortraitReport(undefined)).toBeNull();
    expect(parsePortraitReport({ sections: {} })).toBeNull();
    expect(parsePortraitReport({ sections: { ...valid, version: 2 } })).toBeNull();
    expect(parsePortraitReport({ sections: { ...valid, blocks: valid.blocks.slice(0, 4) } })).toBeNull();
    expect(parsePortraitReport({ sections: "мусор" })).toBeNull();
  });
});
