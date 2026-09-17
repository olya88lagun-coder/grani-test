import { describe, expect, test } from "vitest";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const LONG_HEADINGS = ["## Какие они", "## Сильные стороны", "## Слепые зоны", "## Работа", "## Отношения", "## С кем легко"];

const files = LIBRARY_FILES.filter((file) => file.startsWith("types/") || file.startsWith("stability/"));

describe("type and stability blocks", () => {
  test("exist, fit their length limits and avoid stop topics", () => {
    expect([...checkBlockFiles(BLOCKS_DIR, "types/"), ...checkBlockFiles(BLOCKS_DIR, "stability/")]).toEqual([]);
  });

  test("follow the style rules", () => {
    expect(files.flatMap((file) => styleProblems(file, readBlock(file)))).toEqual([]);
  });

  test("long type pages use exactly the agreed headings in order", () => {
    for (const file of files.filter((candidate) => candidate.endsWith("/long.md"))) {
      const headings = readBlock(file)
        .split("\n")
        .filter((line) => line.startsWith("## "));
      expect(headings, file).toEqual(LONG_HEADINGS);
    }
  });
});
