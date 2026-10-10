import { describe, expect, test } from "vitest";
import { ATLAS_BASE_RULES, ATLAS_PAIR_RULES, buildPersonalityAtlas, editorialWeight } from "./personality-atlas";

const SOFIA = { openness: 85, conscientiousness: 90, extraversion: 25, agreeableness: 35, stability: 65 } as const;

describe("personality atlas v0.3", () => {
  test("Sofia receives the approved diverse resources and unchanged scores", () => {
    const atlas = buildPersonalityAtlas(SOFIA);
    expect(atlas.scores).toEqual(SOFIA);
    expect(atlas.strengths.map(s => s.title)).toEqual(["От идеи к системе", "Самостоятельное погружение", "Ясные критерии"]);
    expect(atlas.strengths[1]!.ruleIds).toEqual(expect.arrayContaining(["R04", "R08"]));
    expect(atlas.strengths[2]!.weight).toBe(0.5);
    expect(atlas.theme).toBe("Идеи, которым ты умеешь придавать форму");
  });

  test("all 15 base and 12 pair rules exist once", () => {
    expect(ATLAS_BASE_RULES).toHaveLength(15);
    expect(ATLAS_PAIR_RULES.map(r => r.id)).toEqual(Array.from({ length:12 },(_,i) => `R${String(i+1).padStart(2,"0")}`));
    expect(new Set(ATLAS_BASE_RULES.map(r => r.id)).size).toBe(15);
  });

  test("editorial weights implement the approved clamps, not score changes", () => {
    expect([editorialWeight("high",55),editorialWeight("high",65),editorialWeight("high",75),editorialWeight("high",100)]).toEqual([0,0.5,1,1]);
    expect([editorialWeight("low",45),editorialWeight("low",35),editorialWeight("low",25),editorialWeight("low",0)]).toEqual([0,0.5,1,1]);
    expect(editorialWeight("borderline",45)).toBeCloseTo(2/3);
    expect([editorialWeight("borderline",35),editorialWeight("borderline",50),editorialWeight("borderline",65)]).toEqual([0,1,0]);
  });

  test.each([0,44,45,50,55,56,100])("boundary %i remains visible with correct test categories", score => {
    const scores={openness:score,conscientiousness:score,extraversion:score,agreeableness:score,stability:score};
    const atlas=buildPersonalityAtlas(scores);
    expect(atlas.traits.map(t=>t.value)).toEqual(Array(5).fill(score));
    expect(atlas.traits.every(t=>t.level===(score<45?"low":score>55?"high":"borderline"))).toBe(true);
    expect(atlas.strengths).toHaveLength(3);
    expect(new Set(atlas.strengths.map(s=>s.group)).size).toBe(3);
    for(const insight of atlas.strengths){expect(insight.basis.length).toBeGreaterThan(0);expect(insight.practice).toBeTruthy();expect(insight.limit).toBeTruthy();}
  });

  test("a different profile is not handed Sofia's theme or first resource", () => {
    const atlas=buildPersonalityAtlas({openness:20,conscientiousness:80,extraversion:80,agreeableness:80,stability:20});
    expect(atlas.theme).not.toBe(buildPersonalityAtlas(SOFIA).theme);
    expect(atlas.strengths[0]!.title).not.toBe("От идеи к системе");
  });

  test.each([-1,101,NaN,Infinity])("invalid score %s is rejected rather than silently clamped", value => {
    expect(()=>buildPersonalityAtlas({...SOFIA,openness:value})).toThrow();
  });
});
