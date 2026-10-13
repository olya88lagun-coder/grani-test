import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { assembleChapterCards, blockTexts, buildChapterPartPrompt, partSeeds, validateOverview, validateSituations, type ChapterCardsContext } from "./chapter-cards";
import { SAMPLE_SCORES, sampleOverview, sampleSituation } from "./testing";

const CTX: ChapterCardsContext = { library: getLibrary(), kind: "chapter_money", result: SAMPLE_SCORES };
const SEEDS_A = partSeeds("chapter_money", "situations_a");
const SEEDS_B = partSeeds("chapter_money", "situations_b");
const situations = (seeds: readonly { id: string; title: string }[]) => JSON.stringify({ situations: seeds.map(sampleSituation) });

describe("partSeeds", () => {
  test("splits the six themes into two groups of three and gives the overview none", () => {
    expect(partSeeds("chapter_money", "overview")).toEqual([]);
    expect(SEEDS_A.map((seed) => seed.id)).toEqual(["help", "surprise", "mood"]);
    expect(SEEDS_B.map((seed) => seed.id)).toEqual(["new", "periods", "shared"]);
  });
});

describe("buildChapterPartPrompt", () => {
  test("the situations prompt carries the themes, the five trait blocks and the writing rules", () => {
    const prompt = buildChapterPartPrompt("situations_a", CTX);
    const user = JSON.parse(prompt.user) as { seeds: { id: string }[]; blocks: Record<string, string>; chapter: string };

    expect(user.chapter).toBe("Деньги");
    expect(user.seeds.map((seed) => seed.id)).toEqual(["help", "surprise", "mood"]);
    expect(Object.keys(user.blocks)).toHaveLength(5);
    expect(prompt.system).toContain("на «ты»");
    expect(prompt.system).toContain("«ты уже…»");
    expect(prompt.system).toContain('"situations"');
  });

  test("the overview prompt asks for the headline, the summary, close people and three traps", () => {
    const prompt = buildChapterPartPrompt("overview", CTX);

    expect(JSON.parse(prompt.user).seeds).toEqual([]);
    for (const key of ['"headline"', '"summary"', '"others_see"', '"traps"']) expect(prompt.system).toContain(key);
  });
});

describe("validateOverview", () => {
  test("accepts a good answer, also wrapped in an explanation and a Markdown fence", () => {
    const json = JSON.stringify(sampleOverview());

    expect(validateOverview(json).ok).toBe(true);
    expect(validateOverview("Вот ответ:\n```json\n" + json + "\n```\nГотово.").ok).toBe(true);
  });

  test("rejects broken JSON, a wrong schema, stop words and filler phrases", () => {
    expect(validateOverview("не json")).toEqual({ ok: false, reason: "not_json" });
    expect(validateOverview("{}")).toMatchObject({ ok: false, reason: "schema" });
    expect(validateOverview(JSON.stringify({ ...sampleOverview(), summary: sampleOverview().summary + " Это похоже на депрессию." }))).toEqual({ ok: false, reason: "stop_words" });
    expect(validateOverview(JSON.stringify({ ...sampleOverview(), others_see: sampleOverview().others_see + " Полезно в твоей конкретной ситуации." }))).toEqual({ ok: false, reason: "style" });
  });
});

describe("validateSituations", () => {
  const ids = SEEDS_A.map((seed) => seed.id);

  test("a schema failure names the offending fields and limits, never the text itself", () => {
    const [first, ...rest] = SEEDS_A.map(sampleSituation);
    const tooLong = "Секретная длинная фраза. ".repeat(20);
    const raw = JSON.stringify({ situations: [{ ...first!, why: tooLong, extra: "x" }, ...rest] });
    const result = validateSituations(raw, ids);

    expect(result).toMatchObject({ ok: false, reason: "schema" });
    const detail = (result as { detail?: string }).detail ?? "";
    expect(detail).toContain("situations.0.why");
    expect(detail).toContain("too_big");
    expect(detail).toContain("320");
    expect(detail).toContain("extra");
    expect(detail).not.toContain("Секретная");
  });

  test("accepts the expected themes in order", () => {
    expect(validateSituations(situations(SEEDS_A), ids).ok).toBe(true);
  });

  test("accepts the title of a theme as the card title even when it is short", () => {
    const cards = SEEDS_A.map((seed) => ({ ...sampleSituation(seed), title: seed.title }));

    expect(Math.min(...SEEDS_A.map((seed) => seed.title.length))).toBeLessThan(20);
    expect(validateSituations(JSON.stringify({ situations: cards }), ids).ok).toBe(true);
  });

  describe("repeated advice", () => {
    const blocks = blockTexts(CTX);
    const libraryTip = blocks.flatMap((block) => block.split(/(?<=[.!?])\s+/)).find((sentence) => sentence.length >= 50 && sentence.length <= 250)!;
    const withAction = (index: number, action: string) =>
      JSON.stringify({ situations: SEEDS_A.map((seed, i) => ({ ...sampleSituation(seed), ...(i === index ? { do: action } : {}) })) });

    test("rejects an action copied from a library block", () => {
      expect(validateSituations(withAction(1, libraryTip), ids, { blocks })).toEqual({ ok: false, reason: "repeat" });
    });

    test("rejects the same action on two cards", () => {
      const raw = JSON.stringify({ situations: SEEDS_A.map((seed) => ({ ...sampleSituation(seed), do: "Раз в месяц просматривай расходы и накопления, даже если кажется, что всё в порядке." })) });

      expect(validateSituations(raw, ids, { blocks })).toEqual({ ok: false, reason: "repeat" });
    });

    test("rejects an action that repeats the neighbouring group", () => {
      const other = sampleSituation(SEEDS_B[0]!).do;

      expect(validateSituations(withAction(0, other), ids, { blocks, avoid: [other] })).toEqual({ ok: false, reason: "repeat" });
    });

    test("on the last attempt a repeat is forgiven, so the chapter does not fall back to plain text", () => {
      expect(validateSituations(withAction(1, libraryTip), ids, { blocks }, true).ok).toBe(true);
    });

    test("accepts distinct actions", () => {
      expect(validateSituations(situations(SEEDS_A), ids, { blocks }).ok).toBe(true);
    });
  });

  test("rejects missing, reordered, duplicated or foreign themes", () => {
    expect(validateSituations(situations(SEEDS_A.slice(0, 2)), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations([...SEEDS_A].reverse()), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations([SEEDS_A[0]!, SEEDS_A[0]!, SEEDS_A[2]!]), ids)).toEqual({ ok: false, reason: "seeds" });
    expect(validateSituations(situations(SEEDS_B), ids)).toEqual({ ok: false, reason: "seeds" });
  });

  test("rejects a card with two hedges and a card that speaks about the reader's past", () => {
    const hedged = { ...sampleSituation(SEEDS_A[0]!), scene: "Может быть, друг просит денег. Возможно, ты сразу согласишься, потому что неловко отказывать близкому человеку." };
    const past = { ...sampleSituation(SEEDS_A[0]!), scene: "Ты уже не раз отдавал деньги, хотя планировал другое, и потом долго переживал из-за этого решения." };
    const rest = SEEDS_A.slice(1).map(sampleSituation);

    expect(validateSituations(JSON.stringify({ situations: [hedged, ...rest] }), ids)).toEqual({ ok: false, reason: "style" });
    expect(validateSituations(JSON.stringify({ situations: [past, ...rest] }), ids)).toEqual({ ok: false, reason: "style" });
  });
});

describe("assembleChapterCards", () => {
  const overview = sampleOverview();
  const part = (seeds: readonly { id: string; title: string }[]) => ({ situations: seeds.map(sampleSituation) });

  test("builds one valid cards chapter from the three parts", () => {
    const sections = assembleChapterCards(overview, part(SEEDS_A), part(SEEDS_B));

    expect(sections?.version).toBe(2);
    expect(sections?.situations.map((situation) => situation.seed)).toEqual(["help", "surprise", "mood", "new", "periods", "shared"]);
  });

  test("refuses a chapter in which two cards share a title", () => {
    const twin = { ...sampleSituation(SEEDS_B[0]!), title: sampleSituation(SEEDS_A[0]!).title };

    expect(assembleChapterCards(overview, part(SEEDS_A), { situations: [twin, ...part(SEEDS_B).situations.slice(1)] })).toBeNull();
  });
});
