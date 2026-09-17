import { describe, expect, test } from "vitest";
import { ALL_TYPE_CODES } from "@grani/core";
import { collectLibrary } from "../scripts/build-library.mjs";
import { BLOCKS_DIR, checkBlockFiles } from "./check";
import { getLibrary } from "./data";
import raw from "./generated/library.json";
import { typeTexts } from "./library";

describe("built library", () => {
  test("has every block file present, within limits and free of stop topics", () => {
    expect(checkBlockFiles(BLOCKS_DIR, "")).toEqual([]);
  });

  test("library.json matches blocks/ — run `pnpm build:library` after editing texts", () => {
    expect(raw).toEqual(collectLibrary(BLOCKS_DIR));
  });

  test("parses and serves texts for every type", () => {
    const library = getLibrary();

    for (const code of ALL_TYPE_CODES) expect(typeTexts(library, code).short.length).toBeGreaterThan(0);
  });

  test("parses the JSON only once", () => {
    expect(getLibrary()).toBe(getLibrary());
  });
});
