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
  test.each(CHAPTER_KINDS)("every theme of %s has an icon file in the public folder", (kind) => {
    const slug = chapterCoverSlug(kind);

    for (const seed of chapterSeeds(kind)) {
      expect(seedIconPath(kind, seed.id)).toBe(`/chapters/${slug}/${seed.id}.webp`);
      expect(existsSync(new URL(`${slug}/${seed.id}.webp`, PUBLIC)), `${slug}/${seed.id}.webp`).toBe(true);
    }
  });

  test("unknown themes and themes of another chapter give no path", () => {
    expect(seedIconPath("chapter_money", "unknown")).toBeNull();
    expect(seedIconPath("chapter_stress", "help")).toBeNull();
  });
});
