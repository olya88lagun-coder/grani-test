import { portraitSeeds, stabilityText, traitBlock, typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { TRAITS, traitLevel } from "@grani/core";
import { describe, expect, test } from "vitest";
import { assemblePortrait, buildPortraitPrompt, freeTexts, portraitSources, validatePortrait, type PortraitContext } from "./portrait-cards";
import { SAMPLE_SCORES, samplePortrait } from "./testing";

const CTX: PortraitContext = { library: getLibrary(), result: SAMPLE_SCORES };
const answer = (patch: (value: ReturnType<typeof samplePortrait>) => unknown = (value) => value) => JSON.stringify(patch(samplePortrait()));
const SOURCES = portraitSources(CTX);

describe("buildPortraitPrompt", () => {
  test("carries the facts, the five themes and, per trait, only the work, relationships and stress blocks", () => {
    const prompt = buildPortraitPrompt(CTX);
    const user = JSON.parse(prompt.user) as { facts: { traits: unknown[] }; seeds: { id: string; title: string }[]; blocks: Record<string, Record<string, string>> };

    expect(user.seeds.map((seed) => seed.id)).toEqual(portraitSeeds().map((seed) => seed.id));
    expect(user.facts.traits).toHaveLength(5);
    expect(Object.keys(user.blocks)).toEqual([...TRAITS]);
    for (const trait of TRAITS) expect(Object.keys(user.blocks[trait]!)).toEqual(["work", "relationships", "stress"]);
    const level = traitLevel(SAMPLE_SCORES.scores.openness);
    expect(user.blocks.openness!.work).toBe(traitBlock(getLibrary(), "openness", level, "work"));
    expect(prompt.system).toContain('"headline"');
    expect(prompt.system).toContain('"blocks"');
    expect(prompt.system).toContain("на «ты»");
    expect(prompt.system).toContain("Не пересказывай");
  });

  test("the free texts never go into the prompt as material to retell", () => {
    const prompt = buildPortraitPrompt(CTX);

    for (const text of freeTexts(CTX)) expect(prompt.user).not.toContain(text.slice(0, 60));
  });
});

describe("freeTexts and portraitSources", () => {
  test("freeTexts are what the free result page shows: type texts, stability and the strengths blocks", () => {
    const texts = freeTexts(CTX);
    const types = typeTexts(getLibrary(), SAMPLE_SCORES.typeCode);

    expect(texts).toContain(types.short);
    expect(texts).toContain(types.long);
    expect(texts).toContain(stabilityText(getLibrary(), SAMPLE_SCORES.stability));
    expect(texts).toContain(traitBlock(getLibrary(), "openness", traitLevel(SAMPLE_SCORES.scores.openness), "strengths"));
    expect(portraitSources(CTX).length).toBeGreaterThan(texts.length);
  });
});

describe("validatePortrait", () => {
  test("accepts a good answer, also wrapped in an explanation and a Markdown fence", () => {
    expect(validatePortrait(answer(), SOURCES).ok).toBe(true);
    expect(validatePortrait("Вот ответ:\n```json\n" + answer() + "\n```\nГотово.", SOURCES).ok).toBe(true);
  });

  test("rejects broken JSON and a wrong schema with the fields at fault", () => {
    expect(validatePortrait("не json", SOURCES)).toEqual({ ok: false, reason: "not_json" });
    const schema = validatePortrait("{}", SOURCES);
    expect(schema).toMatchObject({ ok: false, reason: "schema" });
    if (!schema.ok) expect(schema.hint).toContain("headline");
  });

  test("rejects blocks in a wrong order or with unknown themes", () => {
    const wrong = validatePortrait(answer((value) => ({ ...value, blocks: [...value.blocks].reverse() })), SOURCES);

    expect(wrong).toMatchObject({ ok: false, reason: "seeds" });
  });

  test("rejects a gendered form with a concrete remark, and forgives it on the last attempt", () => {
    const gendered = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 0 ? { ...block, text: `${block.text} Ты открыт новому и не боишься перемен.` } : block)) }));

    const early = validatePortrait(gendered, SOURCES, false);
    expect(early).toMatchObject({ ok: false, reason: "style" });
    if (!early.ok) expect(early.hint).toContain("ты открыт");

    expect(validatePortrait(gendered, SOURCES, true)).toMatchObject({ ok: true, forgiven: expect.arrayContaining(["gendered"]) });
  });

  test("rejects a block that retells a free text, forgives it on the last attempt", () => {
    const retold = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 1 ? { ...block, text: typeTexts(getLibrary(), SAMPLE_SCORES.typeCode).short.slice(0, 340) } : block)) }));

    const early = validatePortrait(retold, SOURCES, false);
    expect(early).toMatchObject({ ok: false, reason: "repeat" });
    expect(validatePortrait(retold, SOURCES, true)).toMatchObject({ ok: true, forgiven: ["repeat"] });
  });

  test("rejects two blocks that say the same thing", () => {
    const twins = answer((value) => ({ ...value, blocks: value.blocks.map((block, index) => (index === 3 ? { ...block, text: value.blocks[2]!.text } : block)) }));

    expect(validatePortrait(twins, SOURCES, false)).toMatchObject({ ok: false, reason: "repeat" });
  });
});

describe("assemblePortrait", () => {
  test("takes the titles from the themes, not from the model", () => {
    const checked = validatePortrait(answer(), SOURCES);
    if (!checked.ok) throw new Error("fixture is not valid");
    const sections = assemblePortrait(checked.value);

    expect(sections?.version).toBe(1);
    expect(sections?.blocks.map((block) => block.title)).toEqual(portraitSeeds().map((seed) => seed.title));
  });
});
