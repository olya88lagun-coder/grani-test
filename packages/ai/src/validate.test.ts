import { getLibrary } from "@grani/content/data";
import { describe, expect, test } from "vitest";
import { fallbackSections } from "./fallback";
import { buildPersonalInput } from "./input";
import { extractJson, validateModelOutput } from "./validate";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;
const VALID = fallbackSections(buildPersonalInput(getLibrary(), "full", RESULT)) as { portrait: string };

describe("extractJson", () => {
  test("reads plain JSON and JSON wrapped in a markdown block", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Вот ответ:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("нет json")).toBeUndefined();
    expect(extractJson("{битый")).toBeUndefined();
  });
});

describe("validateModelOutput", () => {
  test("accepts sections that match the schema", () => {
    expect(validateModelOutput("full", JSON.stringify(VALID))).toEqual({ ok: true, sections: VALID });
  });

  test("names the reason of a rejection", () => {
    expect(validateModelOutput("full", "не json")).toEqual({ ok: false, reason: "not_json" });
    expect(validateModelOutput("full", JSON.stringify({ portrait: "коротко" }))).toEqual({ ok: false, reason: "schema" });
    expect(validateModelOutput("full", JSON.stringify({ ...VALID, portrait: `${VALID.portrait} Возможно, это депрессия.` }))).toEqual({ ok: false, reason: "stop_words" });
  });
});
