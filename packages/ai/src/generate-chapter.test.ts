import { chapterSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import type { ChapterCardsContext } from "./chapter-cards";
import { generateChapterCards } from "./generate-chapter";
import { cardsStubWriter, SAMPLE_SCORES, sampleSituation } from "./testing";

const CTX: ChapterCardsContext = { library: getLibrary(), kind: "chapter_money", result: SAMPLE_SCORES };

describe("generateChapterCards", () => {
  test("makes three requests and assembles one chapter", async () => {
    const stub = cardsStubWriter();

    const result = await generateChapterCards(stub, CTX);

    expect(stub.calls).toHaveLength(3);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.situations).toHaveLength(6);
    expect(result?.sections.version).toBe(2);
  });

  test("retries a part that came back broken without repeating the other parts", async () => {
    const log = vi.fn();
    const stub = cardsStubWriter({ overview: ["не json"] });

    const result = await generateChapterCards(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(4);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ part: "overview", attempt: 1, reason: "not_json" }));
  });

  test("returns null when a part keeps failing, so the caller falls back", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}"] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });

  test("a hanging part ends in null instead of a half-finished chapter", async () => {
    const stub = cardsStubWriter({ situations_a: ["hang", "hang", "hang"] });

    expect(await generateChapterCards(stub, CTX, { timeoutMs: 20 })).toBeNull();
  });

  test("a model error counts as an attempt", async () => {
    const stub = cardsStubWriter({ situations_a: [new Error("503")] });

    const result = await generateChapterCards(stub, CTX);

    expect(result?.attempts).toBe(2);
  });

  test("themes in the wrong order are never accepted, so no chapter is saved", async () => {
    const reversed = JSON.stringify({ situations: [...chapterSeeds("chapter_money").slice(0, 3)].reverse().map(sampleSituation) });
    const stub = cardsStubWriter({ situations_a: [reversed, reversed, reversed] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });
});
