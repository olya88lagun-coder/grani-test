import type { ChapterCardsSections, ChapterTextSections } from "@grani/ai";
import { describe, expect, test } from "vitest";
import { isChapterCards } from "./chapter-view";

describe("isChapterCards", () => {
  test("recognises the cards format by its version and leaves the text format alone", () => {
    const text: ChapterTextSections = { text: "а".repeat(400), tips: ["а".repeat(30), "а".repeat(30), "а".repeat(30)] };

    expect(isChapterCards(text)).toBe(false);
    expect(isChapterCards({ version: 2 } as unknown as ChapterCardsSections)).toBe(true);
  });
});
