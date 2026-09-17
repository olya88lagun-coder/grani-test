import { describe, expect, test } from "vitest";
import { TRAITS } from "@grani/core";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const SINGULAR_YOU = /(?<![а-яё])(ты|тебе|тебя|тобой|твой|твоя|твоё|твои)(?![а-яё])/iu;

describe.each(TRAITS)("pair blocks for %s", (trait) => {
  const files = LIBRARY_FILES.filter((file) => file.startsWith(`pairs/${trait}/`));

  test("exist, fit their length limits and avoid stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, `pairs/${trait}/`)).toEqual([]);
  });

  test("follow the style rules, speak to the couple and end with advice", () => {
    for (const file of files) {
      const text = readBlock(file);
      expect(styleProblems(file, text)).toEqual([]);
      expect(text, file).not.toMatch(SINGULAR_YOU);
      expect(text, file).toContain("Попробуйте:");
    }
  });
});

describe("compatibility level texts", () => {
  const files = LIBRARY_FILES.filter((file) => file.startsWith("compatibility/"));

  test("exist, fit their length limits and avoid stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, "compatibility/")).toEqual([]);
  });

  test("follow the style rules and speak to the couple", () => {
    for (const file of files) {
      const text = readBlock(file);
      expect(styleProblems(file, text)).toEqual([]);
      expect(text, file).not.toMatch(SINGULAR_YOU);
    }
  });

  test("remind in every level text that this is not a relationship forecast", () => {
    for (const file of files.filter((candidate) => candidate.endsWith("/text.md"))) {
      expect(readBlock(file), file).toMatch(/не прогноз/iu);
    }
  });
});
