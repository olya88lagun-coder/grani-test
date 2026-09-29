import { TRAITS } from "@grani/core";
import { describe, expect, it } from "vitest";
import { getTraitGuide } from "./data";
import rawGuides from "./generated/trait-guides.json";
import { PAGE_POLES } from "./keys";
import { findStopWords } from "./safety";
import { TRAIT_SOURCES } from "./sources";
import { parseTraitGuide, TRAIT_GUIDE_SECTIONS } from "./trait-guides";

const SLUGS = TRAITS.flatMap((trait) => PAGE_POLES.map((pole) => `${trait}-${pole}`));
const sentences = (text: string) =>
  text
    .replace(/^#+ .*$/gm, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.length >= 60);

describe("trait guides", () => {
  it("covers every trait page with the full section plan and FAQ", () => {
    for (const slug of SLUGS) {
      const guide = getTraitGuide(slug);
      expect(guide, slug).not.toBeNull();
      expect(guide!.blocks.filter((block) => block.kind === "h2").map((block) => block.text), slug).toEqual([...TRAIT_GUIDE_SECTIONS]);
      expect(guide!.faq.length, slug).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(rawGuides).sort()).toEqual([...SLUGS].sort());
  });

  // ТЗ запрещает шаблон «одна фраза, меняется название черты»: длинные предложения не повторяются между гидами
  it("keeps every guide unique, not a template with the trait name swapped", () => {
    const seen = new Map<string, string>();
    for (const slug of SLUGS) {
      for (const sentence of sentences(getTraitGuide(slug)!.body)) {
        expect(seen.get(sentence), `${slug}: «${sentence.slice(0, 60)}…»`).toBeUndefined();
        seen.set(sentence, slug);
      }
    }
  });

  it("stays away from stop topics", () => {
    for (const slug of SLUGS) {
      const guide = getTraitGuide(slug)!;
      const text = [guide.body, ...guide.faq.flatMap((item) => [item.question, item.answer])].join("\n");
      expect(findStopWords(text), slug).toEqual([]);
    }
  });

  it("backs every trait with at least three verified sources", () => {
    for (const trait of TRAITS) expect(TRAIT_SOURCES[trait]?.length ?? 0, trait).toBeGreaterThanOrEqual(3);
  });

  it("rejects a guide with a missing section", () => {
    const body = "## Как узнать эту черту\n\n" + "Текст. ".repeat(600);
    expect(() => parseTraitGuide("x", `---\nfaq: А? => Б. || В? => Г. || Д? => Е.\n---\n\n${body}`)).toThrow(/sections must be/);
  });
});
