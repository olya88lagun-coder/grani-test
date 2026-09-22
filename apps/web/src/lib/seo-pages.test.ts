import { describe, expect, it } from "vitest";
import { oppositePole, traitPageTitle, typeDisplayName, typePoles, typesWithPole } from "./seo-pages";

describe("seo page helpers", () => {
  it("shows both name forms when the type has a feminine one", () => {
    expect(typeDisplayName("++++")).toBe("Вдохновитель / Вдохновительница");
    expect(typeDisplayName("+-++")).toBe("Искра");
  });

  it("reads trait poles from the type code in the type trait order", () => {
    expect(typePoles("+-+-")).toEqual([
      { trait: "openness", pole: "high" },
      { trait: "conscientiousness", pole: "low" },
      { trait: "extraversion", pole: "high" },
      { trait: "agreeableness", pole: "low" },
    ]);
  });

  it("lists the eight types with a given pole and none for stability", () => {
    const high = typesWithPole("extraversion", "high");
    expect(high).toHaveLength(8);
    expect(high.every((code) => code[2] === "+")).toBe(true);
    expect(typesWithPole("openness", "low").every((code) => code[0] === "-")).toBe(true);
    expect(typesWithPole("stability", "high")).toEqual([]);
  });

  it("builds trait page titles in lower case after the adjective", () => {
    expect(traitPageTitle("openness", "high")).toBe("Высокая открытость опыту");
    expect(traitPageTitle("stability", "low")).toBe("Низкая эмоциональная устойчивость");
    expect(oppositePole("high")).toBe("low");
    expect(oppositePole("low")).toBe("high");
  });
});
