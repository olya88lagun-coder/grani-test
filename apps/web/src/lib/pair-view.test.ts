import { compatibilityLevel, compatibilityScore, type TraitScores } from "@grani/core";
import { compatibilityTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import type { PairRecord } from "@grani/db";
import { describe, expect, test } from "vitest";
import { buildPairReportView, buildPairView, pairConsentLabel } from "./pair-view";

const ANNA: TraitScores = { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 55 };
const BORIS: TraitScores = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

const PAIR: PairRecord = {
  id: "pair-1",
  createdAt: new Date("2026-09-17T12:00:00Z"),
  members: [
    { user: { id: "u-anna", displayName: "Аня Петрова", gender: "female" }, result: { id: "r-a", scores: ANNA, typeCode: "+-++", stability: "calm" } },
    { user: { id: "u-boris", displayName: "Борис", gender: "male" }, result: { id: "r-b", scores: BORIS, typeCode: "-+-+", stability: "sensitive" } },
  ],
};

describe("buildPairView", () => {
  test("puts the viewer first and the partner second", () => {
    const forBoris = buildPairView(getLibrary(), PAIR, "u-boris");

    expect(forBoris.you).toEqual({ firstName: "Борис", typeName: "Тихий хранитель", dir: "mpmp" });
    expect(forBoris.partner).toEqual({ firstName: "Аня", typeName: "Искра", dir: "pmpp" });
    expect(forBoris.rows.find((row) => row.trait === "openness")).toEqual({ trait: "openness", label: "Открытость опыту", you: 45, partner: 80 });
  });

  test("uses the core score and the level texts for both viewers", () => {
    const score = compatibilityScore(ANNA, BORIS);
    const texts = compatibilityTexts(getLibrary(), compatibilityLevel(score));

    const forAnna = buildPairView(getLibrary(), PAIR, "u-anna");

    expect(forAnna).toMatchObject({ pairId: "pair-1", score, phrase: texts.phrase, text: texts.text });
    expect(buildPairView(getLibrary(), PAIR, "u-boris").score).toBe(score);
    expect(forAnna.you.typeName).toBe("Искра");
  });
});

describe("pairConsentLabel", () => {
  test("names what each side will see without guessing gender", () => {
    expect(pairConsentLabel("Аня", "female")).toBe("Аня увидит мой тип и шкалы, а я — её");
    expect(pairConsentLabel("Борис", "male")).toBe("Борис увидит мой тип и шкалы, а я — его");
    expect(pairConsentLabel("Саша", null)).toBe("Саша и я увидим типы и шкалы друг друга");
  });
});

describe("buildPairReportView", () => {
  const SECTIONS = { similar: "п".repeat(300), differences: "р".repeat(300), conflicts: "к".repeat(300), home_money: "д".repeat(300), support: "о".repeat(300) };
  const report = { id: "rep", resultId: null, pairId: "pair-1", kind: "pair" as const, sections: SECTIONS, source: "ai" as const, createdAt: new Date() };

  test("offers the report, then prepares it, then shows five titled sections", () => {
    expect(buildPairReportView({ owned: [], report: null })).toEqual({ state: "available", price: "399 ₽" });
    expect(buildPairReportView({ owned: ["pair"], report: null })).toEqual({ state: "preparing" });

    const ready = buildPairReportView({ owned: ["pair"], report });

    expect(ready.state === "ready" && ready.sections.map((section) => section.title)).toEqual([
      "В чём вы похожи",
      "Где вы разные и как это использовать",
      "Откуда будут конфликты и как договариваться",
      "Быт и деньги",
      "Как поддерживать друг друга",
    ]);
  });
});
