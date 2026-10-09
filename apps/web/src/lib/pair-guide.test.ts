import { describe, expect, test } from "vitest";
import type { PairView } from "./pair-view";
import { buildPairGuide } from "./pair-guide";

const view: PairView = {
  pairId: "test-pair", score: 60, phrase: "", text: "",
  you: { firstName: "Первый", typeName: "", dir: "pppp" },
  partner: { firstName: "Второй", typeName: "", dir: "mmmm" },
  rows: [
    { trait: "openness", label: "Открытость", you: 90, partner: 20 },
    { trait: "conscientiousness", label: "Порядок", you: 80, partner: 30 },
    { trait: "extraversion", label: "Общение", you: 75, partner: 25 },
    { trait: "agreeableness", label: "Доброжелательность", you: 60, partner: 60 },
    { trait: "stability", label: "Устойчивость", you: 20, partner: 80 },
  ],
};

describe("pair guide", () => {
  test("switches the advice subject rather than reusing the viewer's profile", () => {
    const mine = buildPairGuide(view, "you");
    const theirs = buildPairGuide(view, "partner");
    expect(mine.subject.firstName).toBe("Первый");
    expect(theirs.subject.firstName).toBe("Второй");
    expect(mine.situations.find(s => s.id === "social")?.need).toContain("совместное общение");
    expect(theirs.situations.find(s => s.id === "social")?.need).toContain("время в тишине");
    expect(mine.situations.find(s => s.id === "support")?.need).toContain("бережный темп");
    expect(theirs.situations.find(s => s.id === "support")?.need).toContain("спокойный разбор");
  });

  test("finds the actual largest difference and common ground", () => {
    const guide = buildPairGuide(view, "you");
    expect(guide.difference.trait).toBe("openness");
    expect(guide.common.trait).toBe("agreeableness");
    expect(guide.situations).toHaveLength(8);
    expect(new Set(guide.situations.map(s => s.id)).size).toBe(8);
  });

  test("avoids forcing a midpoint into a high or low pole", () => {
    const middle = { ...view, rows: view.rows.map(r => ({ ...r, you: 50, partner: 50 })) };
    expect(buildPairGuide(middle, "you").situations.find(s => s.id === "social")?.need).toContain("баланс общения и уединения");
  });

  test("keeps hypotheses reversible and does not infer money or intimacy facts", () => {
    const guide = buildPairGuide(view, "you");
    for (const situation of guide.situations) {
      expect(situation.hypothesis).toContain("Возможно");
      expect(situation.question.length).toBeGreaterThan(20);
      expect(situation.partnerNeed.length).toBeGreaterThan(20);
    }
    expect(guide.situations.find(s => s.id === "money")?.caution).toContain("доход");
    expect(guide.situations.find(s => s.id === "closeness")?.caution).toContain("сексуальные");
  });
});
