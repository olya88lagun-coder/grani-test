import { lifeSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { partSeeds } from "./chapter-cards";
import { generateLifeCards } from "./generate-life";
import { cardsStubWriter, SAMPLE_SCORES, sampleSituation } from "./testing";

const CTX = { library: getLibrary(), result: SAMPLE_SCORES };
const situationsOf = (part: "situations_a" | "situations_b", patch: (card: ReturnType<typeof sampleSituation>) => unknown = (card) => card) =>
  JSON.stringify({ situations: partSeeds("life", part).map((seed) => patch(sampleSituation(seed))) });

describe("generateLifeCards", () => {
  test("makes two requests and assembles five cards in the editorial order", async () => {
    const stub = cardsStubWriter();

    const result = await generateLifeCards(stub, CTX);

    expect(stub.calls).toHaveLength(2);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.version).toBe(1);
    expect(result?.sections.situations.map((card) => card.seed)).toEqual(lifeSeeds().map((seed) => seed.id));
  });

  test("retries a broken part without repeating the other one and names the part in the log", async () => {
    const log = vi.fn();
    const stub = cardsStubWriter({ situations_a: ["не json"] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(3);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ kind: "life", part: "situations_a", attempt: 1, reason: "not_json" }));
  });

  test("a retry carries the concrete remark about the previous answer", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}"] });

    await generateLifeCards(stub, CTX);

    const fixes = stub.calls.map((call) => (JSON.parse(call.user) as { fix?: string }).fix).filter(Boolean);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toContain("situations");
  });

  test("gives up with null after five rejected attempts, never returning a half-made set", async () => {
    const stub = cardsStubWriter({ situations_b: ["{}", "{}", "{}", "{}", "{}"] });

    expect(await generateLifeCards(stub, CTX)).toBeNull();
  });

  test("the last attempt forgives a gendered form and says so in the log", async () => {
    const log = vi.fn();
    const gendered = situationsOf("situations_a", (card) => ({ ...card, why: "Здесь сходятся твои черты: ты открыт новому, поэтому важно заранее знать свой ответ." }));
    const stub = cardsStubWriter({ situations_a: [gendered, gendered, gendered, gendered, gendered] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(result?.attempts).toBe(5);
    expect(log).toHaveBeenCalledWith("chapter part accepted with remarks", expect.objectContaining({ kind: "life", part: "situations_a", attempt: 5, forgiven: expect.arrayContaining(["gendered"]) }));
  });

  test("when the second group repeats the first group's advice it is asked again", async () => {
    const log = vi.fn();
    const first = sampleSituation(lifeSeeds()[0]!);
    const repeating = JSON.stringify({ situations: partSeeds("life", "situations_b").map((seed, index) => (index === 0 ? { ...sampleSituation(seed), do: first.do } : sampleSituation(seed))) });
    const stub = cardsStubWriter({ situations_b: [repeating] });

    const result = await generateLifeCards(stub, CTX, { log });

    expect(log).toHaveBeenCalledWith("chapter part repeats another", expect.objectContaining({ kind: "life", part: "situations_b" }));
    expect(stub.calls).toHaveLength(3);
    expect(result?.sections.situations[3]?.do).not.toBe(first.do);
  });
});
