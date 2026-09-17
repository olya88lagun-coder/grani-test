import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { checkBlockFiles, checkBlockText, normalizeBlock } from "./check";
import { LIBRARY_FILES, LIMITS } from "./keys";
import { placeholderText, writeLibraryFiles } from "./testing";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grani-blocks-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("normalizeBlock", () => {
  test("converts CRLF to LF and trims", () => {
    expect(normalizeBlock("\r\n  Первый.\r\nВторой.  \r\n")).toBe("Первый.\nВторой.");
  });
});

describe("checkBlockText", () => {
  const file = "compatibility/good/phrase.md";

  test("accepts text within limits", () => {
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.min))).toEqual([]);
  });

  test("reports too short and too long text", () => {
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.min - 1))).toEqual([
      { file, problem: `too short: 19 < 20` },
    ]);
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.max + 1))).toEqual([
      { file, problem: `too long: 161 > 160` },
    ]);
  });

  test("reports stop words", () => {
    expect(checkBlockText(file, "У вас похожий диагноз, но это не страшно.")).toEqual([
      { file, problem: "stop word: diagnosis" },
    ]);
  });
});

describe("checkBlockFiles", () => {
  test("reports every missing file of a group", () => {
    const problems = checkBlockFiles(dir, "stability/");

    expect(problems).toEqual([
      { file: "stability/calm.md", problem: "missing" },
      { file: "stability/sensitive.md", problem: "missing" },
    ]);
  });

  test("passes a complete group", () => {
    writeLibraryFiles(
      dir,
      LIBRARY_FILES.filter((file) => file.startsWith("types/")),
    );

    expect(checkBlockFiles(dir, "types/")).toEqual([]);
  });

  test("normalizes files before measuring", () => {
    const file = "stability/calm.md";
    writeLibraryFiles(dir, ["stability/calm.md", "stability/sensitive.md"]);
    writeFileSync(join(dir, "stability", "calm.md"), `\r\n\r\n${placeholderText(file)}\r\n\r\n`, "utf8");

    expect(checkBlockFiles(dir, "stability/")).toEqual([]);
  });
});
