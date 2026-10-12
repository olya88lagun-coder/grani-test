import { existsSync } from "node:fs";
import { CHAPTER_KINDS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterCoverSlug } from "./chapter-cover";

const PUBLIC = new URL("../../public/chapters/", import.meta.url);

describe("chapterCoverSlug", () => {
  test("maps every chapter to a short name used in the cover file names", () => {
    expect(CHAPTER_KINDS.map(chapterCoverSlug)).toEqual(["money", "conflict", "stress", "relationships"]);
  });

  test("every chapter has a desktop and a mobile cover in the public folder", () => {
    for (const kind of CHAPTER_KINDS) {
      const slug = chapterCoverSlug(kind);
      expect(existsSync(new URL(`${slug}-desktop.webp`, PUBLIC)), `${slug}-desktop.webp`).toBe(true);
      expect(existsSync(new URL(`${slug}-mobile.webp`, PUBLIC)), `${slug}-mobile.webp`).toBe(true);
    }
  });
});
