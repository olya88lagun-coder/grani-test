import type { TraitScores } from "@grani/core";
import { typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { TRAIT_LABELS, buildResultView } from "./result-view";

const scores: TraitScores = { openness: 80, conscientiousness: 30, extraversion: 50, agreeableness: 62, stability: 40 };
const result = { typeCode: "+-++" as const, stability: "sensitive" as const, scores };

describe("buildResultView", () => {
  test("uses the gendered type name when gender is known", () => {
    expect(buildResultView(getLibrary(), result, "female").name).toBe("Искра");
    expect(buildResultView(getLibrary(), { ...result, typeCode: "++-+" }, "female").name).toBe("Созидательница");
    expect(buildResultView(getLibrary(), { ...result, typeCode: "++-+" }, null).name).toBe("Созидатель");
  });

  test("maps the type code to its directory and texts", () => {
    const view = buildResultView(getLibrary(), result, null);
    expect(view.dir).toBe("pmpp");
    expect(view.shortText).toBe(typeTexts(getLibrary(), "+-++").short);
    expect(view.stabilityTag).toBe("Чувствительность");
    expect(view.stabilityText).toBe(getLibrary().stability.sensitive);
  });

  test("lists five scales in trait order with labels and level texts", () => {
    const view = buildResultView(getLibrary(), result, null);
    expect(view.scales.map((scale) => scale.label)).toEqual(Object.values(TRAIT_LABELS));
    const extraversion = view.scales.find((scale) => scale.trait === "extraversion");
    expect(extraversion).toMatchObject({ score: 50, borderline: true });
    expect(extraversion?.text).toBe(getLibrary().traits.extraversion.borderline.strengths);
    const openness = view.scales.find((scale) => scale.trait === "openness");
    expect(openness).toMatchObject({ score: 80, borderline: false, text: getLibrary().traits.openness.high.strengths });
  });

  test("labels a calm result", () => {
    expect(buildResultView(getLibrary(), { ...result, stability: "calm" }, null).stabilityTag).toBe("Спокойствие");
  });
});
