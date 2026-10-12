import { existsSync } from "node:fs";
import { chapterSeeds } from "@grani/content";
import { CHAPTER_KINDS } from "@grani/core";
import { describe, expect, test } from "vitest";
import { chapterCoverSlug, seedIconPath } from "./chapter-cover";

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

describe("seedIconPath", () => {
  test("every money theme has an icon file in the public folder", () => {
    for (const seed of chapterSeeds("chapter_money")) {
      const path = seedIconPath("chapter_money", seed.id);
      expect(path).toBe(`/chapters/money/${seed.id}.webp`);
      expect(existsSync(new URL(`money/${seed.id}.webp`, PUBLIC)), `${seed.id}.webp`).toBe(true);
    }
  });

  test("unknown themes and chapters without icons give no path", () => {
    expect(seedIconPath("chapter_money", "unknown")).toBeNull();
    expect(seedIconPath("chapter_stress", "help")).toBeNull();
  });
});
