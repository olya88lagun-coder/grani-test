import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { collectLibrary } from "../scripts/build-library.mjs";
import { LIBRARY_FILES } from "./keys";
import {
  compatibilityTexts,
  LibraryError,
  pairBlock,
  parseLibrary,
  stabilityText,
  traitBlock,
  traitPageIntro,
  typeTexts,
} from "./library";
import { placeholderText, writeLibraryFiles } from "./testing";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grani-library-"));
  writeLibraryFiles(dir, LIBRARY_FILES);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("collectLibrary + parseLibrary", () => {
  test("accepts a complete library", () => {
    expect(() => parseLibrary(collectLibrary(dir))).not.toThrow();
  });

  test("names the missing block", () => {
    unlinkSync(join(dir, "pairs", "openness", "different", "support.md"));

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(/pairs\/openness\/different\/support/);
  });

  test("rejects a text below its minimum length", () => {
    writeFileSync(join(dir, "types", "ppmp", "short.md"), "Коротко.", "utf8");

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(LibraryError);
  });

  test("rejects unexpected files", () => {
    writeFileSync(join(dir, "stability", "extra.md"), placeholderText("stability/calm.md"), "utf8");

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(/extra/);
  });

  test("ignores non-markdown files and normalizes line endings", () => {
    writeFileSync(join(dir, "README.txt"), "заметки", "utf8");
    writeFileSync(join(dir, "stability", "calm.md"), `\r\n${placeholderText("stability/calm.md")}\r\n`, "utf8");

    const library = parseLibrary(collectLibrary(dir));

    expect(stabilityText(library, "calm")).toBe(placeholderText("stability/calm.md"));
  });
});

describe("accessors", () => {
  test("return the text of the matching file", () => {
    const library = parseLibrary(collectLibrary(dir));

    expect(traitBlock(library, "openness", "borderline", "blind_spots")).toBe(
      placeholderText("traits/openness/borderline/blind_spots.md"),
    );
    expect(traitPageIntro(library, "stability", "low")).toBe(placeholderText("trait-pages/stability/low.md"));
    expect(typeTexts(library, "+-++")).toEqual({
      short: placeholderText("types/pmpp/short.md"),
      long: placeholderText("types/pmpp/long.md"),
    });
    expect(pairBlock(library, "extraversion", "both_low", "home_money")).toBe(
      placeholderText("pairs/extraversion/both_low/home_money.md"),
    );
    expect(compatibilityTexts(library, "effort")).toEqual({
      phrase: placeholderText("compatibility/effort/phrase.md"),
      text: placeholderText("compatibility/effort/text.md"),
    });
  });
});
