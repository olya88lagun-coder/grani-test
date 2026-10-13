import { chapterSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import type { ChapterCardsContext } from "./chapter-cards";
import { generateChapterCards } from "./generate-chapter";
import { cardsStubWriter, SAMPLE_SCORES, sampleOverview, sampleSituation } from "./testing";

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

  test("a rejection for a wrong schema is logged with the fields at fault", async () => {
    const log = vi.fn();
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    await generateChapterCards(stub, CTX, { log });

    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ part: "situations_b", reason: "schema", detail: expect.stringContaining("situations") }));
  });

  test("asks the second group again when its advice repeats the first group", async () => {
    const [a, b] = [chapterSeeds("chapter_money").slice(0, 3), chapterSeeds("chapter_money").slice(3)];
    const repeating = JSON.stringify({ situations: b.map((seed, index) => ({ ...sampleSituation(seed), ...(index === 0 ? { do: sampleSituation(a[0]!).do } : {}) })) });
    const log = vi.fn();
    const stub = cardsStubWriter({ situations_b: [repeating] });

    const result = await generateChapterCards(stub, CTX, { log });

    expect(stub.calls).toHaveLength(4);
    expect(new Set(result?.sections.situations.map((card) => card.do)).size).toBe(6);
    expect(log).toHaveBeenCalledWith("chapter part repeats another", expect.objectContaining({ part: "situations_b" }));
  });

  test("asks the overview again when its way-outs repeat the advice of the cards", async () => {
    const seeds = chapterSeeds("chapter_money");
    const first = sampleSituation(seeds[0]!).do;
    const base = sampleOverview();
    const repeating = JSON.stringify({ ...base, traps: [{ ...base.traps[0]!, instead: first }, base.traps[1]!, base.traps[2]!] });
    const log = vi.fn();
    const stub = cardsStubWriter({ overview: [repeating] });

    const result = await generateChapterCards(stub, CTX, { log });

    expect(stub.calls).toHaveLength(4);
    expect(result?.sections.traps.map((trap) => trap.instead)).not.toContain(first);
    expect(log).toHaveBeenCalledWith("chapter part repeats another", expect.objectContaining({ part: "overview" }));
  });

  test("the next request carries the remark about the previous answer", async () => {
    const gendered = JSON.stringify({ ...sampleOverview(), headline: "Ты щедр к людям, но тревожишься из-за неожиданных трат и расходов" });
    const stub = cardsStubWriter({ overview: [gendered] });

    await generateChapterCards(stub, CTX);

    const second = stub.calls.filter((call) => (JSON.parse(call.user) as { seeds: unknown[] }).seeds.length === 0)[1]!;
    expect(JSON.parse(second.user).fix).toContain("«ты щедр»");
    expect(stub.calls[0]!.user).not.toContain('"fix"');
  });

  test("the last attempt accepts a gendered form but says so in the log", async () => {
    const gendered = JSON.stringify({ ...sampleOverview(), headline: "Ты щедр к людям, но тревожишься из-за неожиданных трат и расходов" });
    const log = vi.fn();
    const stub = cardsStubWriter({ overview: [gendered, gendered, gendered, gendered, gendered] });

    const result = await generateChapterCards(stub, CTX, { log });

    expect(result).not.toBeNull();
    expect(log).toHaveBeenCalledWith("chapter part accepted with remarks", expect.objectContaining({ part: "overview", forgiven: ["gendered"] }));
  });

  test("gives every part five attempts before the chapter falls back", async () => {
    const stub = cardsStubWriter({ situations_a: ["{}", "{}", "{}", "{}"] });

    const result = await generateChapterCards(stub, CTX);

    expect(result?.attempts).toBe(5);
    expect(stub.calls).toHaveLength(7);
  });

  test("returns null when a part keeps failing, so the caller falls back", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });

  test("a hanging part ends in null instead of a half-finished chapter", async () => {
    const stub = cardsStubWriter({ situations_a: ["hang", "hang", "hang", "hang", "hang"] });

    expect(await generateChapterCards(stub, CTX, { timeoutMs: 20 })).toBeNull();
  });

  test("a model error counts as an attempt", async () => {
    const stub = cardsStubWriter({ situations_a: [new Error("503")] });

    const result = await generateChapterCards(stub, CTX);

    expect(result?.attempts).toBe(2);
  });

  test("themes in the wrong order are never accepted, so no chapter is saved", async () => {
    const reversed = JSON.stringify({ situations: [...chapterSeeds("chapter_money").slice(0, 3)].reverse().map(sampleSituation) });
    const stub = cardsStubWriter({ situations_a: [reversed, reversed, reversed, reversed, reversed] });

    expect(await generateChapterCards(stub, CTX)).toBeNull();
  });
});
