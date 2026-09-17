import { describe, expect, test } from "vitest";
import { TRAITS } from "@grani/core";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { readBlock, styleProblems } from "./blocks-texts";
import { LIBRARY_FILES } from "./keys";

const files = LIBRARY_FILES.filter((file) => file.startsWith("traits/") || file.startsWith("trait-pages/"));

describe.each(TRAITS)("%s blocks", (trait) => {
  const traitFiles = files.filter((file) => file.split("/")[1] === trait);

  test("exist, fit their length limits and avoid stop topics", () => {
    expect([
      ...checkBlockFiles(BLOCKS_DIR, `traits/${trait}/`),
      ...checkBlockFiles(BLOCKS_DIR, `trait-pages/${trait}/`),
    ]).toEqual([]);
  });

  test("follow the style rules", () => {
    expect(traitFiles.flatMap((file) => styleProblems(file, readBlock(file)))).toEqual([]);
  });

  test("use bullet lists for strengths and blind spots and advice elsewhere", () => {
    for (const file of traitFiles.filter((candidate) => candidate.startsWith("traits/"))) {
      const text = readBlock(file);
      if (file.endsWith("/strengths.md")) {
        expect(text.split("\n").filter((line) => line.startsWith("- ")).length, file).toBeGreaterThanOrEqual(2);
      } else if (file.endsWith("/blind_spots.md")) {
        expect(text.match(/Что с этим делать:/g)?.length ?? 0, file).toBeGreaterThanOrEqual(2);
      } else {
        expect(text, file).toContain("Что помогает:");
      }
    }
  });
});
