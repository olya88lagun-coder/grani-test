import { describe, expect, test } from "vitest";
import { parseSections, sectionStrings } from "./sections";

const long = (n: number) => "а".repeat(n);

describe("parseSections", () => {
  test("accepts a complete full report", () => {
    const sections = {
      portrait: long(400),
      strengths: [long(30), long(30), long(30), long(30)],
      blind_spots: [1, 2, 3].map(() => ({ text: long(30), tip: long(30) })),
      manual: { work: [long(20), long(20), long(20)], fight: [long(20), long(20), long(20)], annoys: [long(20), long(20), long(20)] },
    };

    expect(parseSections("full", sections)).toEqual(sections);
  });

  test("rejects missing sections, extra keys and wrong lengths", () => {
    expect(parseSections("friends", {})).toBeNull();
    expect(parseSections("friends", { text: long(300), extra: "x" })).toBeNull();
    expect(parseSections("friends", { text: long(50) })).toBeNull();
    expect(parseSections("chapter_money", { text: long(500), tips: [long(30)] })).toBeNull();
  });
});

test("sectionStrings collects every text for the stop-word check", () => {
  expect(sectionStrings({ a: "x", b: ["y", { c: "z" }], d: 3 })).toEqual(["x", "y", "z"]);
});
