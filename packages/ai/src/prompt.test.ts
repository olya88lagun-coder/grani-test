import { getLibrary } from "@grani/content/data";
import { expect, test } from "vitest";
import { buildPairInput, buildPersonalInput } from "./input";
import { buildPrompt } from "./prompt";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;

test("the personal instruction speaks to «ты», forbids new facts and describes the JSON shape", () => {
  const prompt = buildPrompt(buildPersonalInput(getLibrary(), "full", RESULT));

  expect(prompt.system).toContain("на «ты»");
  expect(prompt.system).toContain("не добавляй фактов");
  expect(prompt.system).toContain('"blind_spots"');
  expect(JSON.parse(prompt.user).facts.typeName).toBe("Искра");
});

// YandexGPT копирует число элементов из примера: с одним объектом в blind_spots возвращал одну зону, и схема отклоняла ответ
test("the full instruction shows several blind spots and states list sizes outside the examples", () => {
  const prompt = buildPrompt(buildPersonalInput(getLibrary(), "full", RESULT));

  expect(prompt.system.match(/"tip"/g)?.length).toBeGreaterThanOrEqual(3);
  expect(prompt.system).toContain("blind_spots — 3–4");
  expect(prompt.system).toContain("strengths — 4–5");
});

test("every chapter instruction states the tips count outside the example", () => {
  for (const kind of ["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"] as const) {
    expect(buildPrompt(buildPersonalInput(getLibrary(), kind, RESULT)).system).toContain("tips — 3–5");
  }
});

test("the pair instruction speaks to «вы» and lists the five sections", () => {
  const prompt = buildPrompt(buildPairInput(getLibrary(), RESULT.scores, RESULT.scores));

  expect(prompt.system).toContain("на «вы»");
  for (const key of ["similar", "differences", "conflicts", "home_money", "support"]) expect(prompt.system).toContain(`"${key}"`);
});
