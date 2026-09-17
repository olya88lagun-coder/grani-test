import { describe, expect, test } from "vitest";
import { LIBRARY_FILES, LIMITS, limitFor, TYPE_DIRS, typeCodeToDir } from "./keys";

describe("LIBRARY_FILES", () => {
  test("lists 234 unique markdown files", () => {
    expect(LIBRARY_FILES).toHaveLength(234);
    expect(new Set(LIBRARY_FILES).size).toBe(234);
    for (const file of LIBRARY_FILES) expect(file).toMatch(/^[a-z-]+\/[a-z_/]+\.md$/);
  });

  test("counts files per group as in the spec", () => {
    const count = (prefix: string) => LIBRARY_FILES.filter((file) => file.startsWith(prefix)).length;

    expect(count("traits/")).toBe(105);
    expect(count("trait-pages/")).toBe(10);
    expect(count("types/")).toBe(32);
    expect(count("stability/")).toBe(2);
    expect(count("pairs/")).toBe(75);
    expect(count("compatibility/")).toBe(10);
  });
});

describe("typeCodeToDir", () => {
  test("encodes plus as p and minus as m", () => {
    expect(typeCodeToDir("++-+")).toBe("ppmp");
    expect(typeCodeToDir("----")).toBe("mmmm");
  });

  test("gives 16 distinct directories", () => {
    expect(new Set(TYPE_DIRS).size).toBe(16);
  });
});

describe("limitFor", () => {
  test.each([
    ["traits/openness/high/strengths.md", LIMITS.traitBlock],
    ["trait-pages/stability/low.md", LIMITS.traitPage],
    ["types/ppmp/short.md", LIMITS.typeShort],
    ["types/ppmp/long.md", LIMITS.typeLong],
    ["stability/calm.md", LIMITS.stability],
    ["pairs/agreeableness/different/support.md", LIMITS.pairBlock],
    ["compatibility/good/phrase.md", LIMITS.compatibilityPhrase],
    ["compatibility/good/text.md", LIMITS.compatibilityText],
  ] as const)("%s", (file, limit) => {
    expect(limitFor(file)).toEqual(limit);
  });

  test("throws for an unknown file", () => {
    expect(() => limitFor("notes/readme.md")).toThrow(/notes\/readme\.md/);
  });
});
