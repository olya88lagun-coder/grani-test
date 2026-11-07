import { scoreShortTest, type Answer, type Answers } from "@grani/core";
import { describe, expect, test } from "vitest";
import { findStopWords } from "../safety";
import { getShortTest, SHORT_TESTS, shortTestTypeBySlug } from "./index";
import type { ShortTestDefinition } from "./types";

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

function allTexts(t: ShortTestDefinition): string[] {
  return [
    // disclaimer не проверяется: он и есть отрицание диагноза
    t.title, t.description, t.h1, t.brief, t.intro,
    ...t.items.map((i) => i.text),
    ...t.axes.flatMap((a) => [a.label, a.low, a.high, a.mixed]),
    ...t.types.flatMap((ty) => [ty.name, ty.tagline, ty.summary, ty.page.title, ty.page.description, ...ty.page.sections.flatMap((s) => [s.heading, s.text])]),
    ...t.sections.flatMap((s) => [s.heading, s.text]),
    ...t.faq.flatMap((f) => [f.question, f.answer]),
  ];
}

// Синтетические ответы, которые кладут каждую ось на нужный полюс
function answersFor(t: ShortTestDefinition, levels: Record<string, "low" | "high">): Answers {
  return Object.fromEntries(
    t.scoring.items.map((item) => {
      const high = levels[item.axis] === "high";
      const value: Answer = high !== item.reverse ? 5 : 1;
      return [item.id, value];
    }),
  );
}

describe.each(SHORT_TESTS.map((t) => [t.slug, t] as const))("short test %s", (_slug, t) => {
  test("item ids are unique and match scoring one to one", () => {
    const ids = t.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(t.scoring.items.map((i) => i.id).sort());
  });

  test("scoring types and content types match, type slugs are unique", () => {
    expect(t.types.map((ty) => ty.key).sort()).toEqual(t.scoring.types.map((r) => r.key).sort());
    expect(new Set(t.types.map((ty) => ty.slug)).size).toBe(t.types.length);
  });

  test("every axis quadrant resolves to a type", () => {
    const [x, y] = t.scoring.axes as [string, string];
    for (const lx of ["low", "high"] as const) {
      for (const ly of ["low", "high"] as const) {
        expect(() => scoreShortTest(t.scoring, answersFor(t, { [x]: lx, [y]: ly }))).not.toThrow();
      }
    }
  });

  test("no stop words in any text", () => {
    const hits = allTexts(t).map((text) => [text.slice(0, 40), findStopWords(text)] as const).filter(([, found]) => found.length > 0);
    expect(hits).toEqual([]);
  });

  test("pages are long enough and FAQ has at least 5 questions", () => {
    for (const ty of t.types) expect(words(ty.page.sections.map((s) => s.text).join(" ")), ty.slug).toBeGreaterThanOrEqual(400);
    expect(words(t.sections.map((s) => s.text).join(" "))).toBeGreaterThanOrEqual(600);
    expect(t.faq.length).toBeGreaterThanOrEqual(5);
  });

  test("disclaimer says this is not a diagnosis", () => {
    expect(t.disclaimer).toContain("не диагноз");
  });

  test("path is not under robots Disallow: /test", () => {
    expect(t.path.startsWith("/test")).toBe(false);
  });

  test("description fits a snippet", () => {
    expect(t.description.length).toBeLessThanOrEqual(160);
    for (const ty of t.types) expect(ty.page.description.length, ty.slug).toBeLessThanOrEqual(160);
  });

  // Layout дописывает « — Грани»: вместе с ним title не длиннее 65 знаков, иначе выдача его обрежет
  test("titles fit with the site suffix", () => {
    expect(t.title.length).toBeLessThanOrEqual(57);
    for (const ty of t.types) expect(ty.page.title.length, ty.slug).toBeLessThanOrEqual(57);
  });
});

describe("attachment test", () => {
  const t = getShortTest("attachment")!;

  test("has 30 items, 15 per axis, 6–9 reversed per axis", () => {
    expect(t.items).toHaveLength(30);
    for (const axis of ["anxiety", "avoidance"]) {
      const onAxis = t.scoring.items.filter((i) => i.axis === axis);
      expect(onAxis).toHaveLength(15);
      const reversed = onAxis.filter((i) => i.reverse).length;
      expect(reversed).toBeGreaterThanOrEqual(6);
      expect(reversed).toBeLessThanOrEqual(9);
    }
  });

  test("type slugs resolve", () => {
    expect(shortTestTypeBySlug(t, "nadezhnyy")?.key).toBe("secure");
    expect(shortTestTypeBySlug(t, "trevozhno-izbegayushchiy")?.key).toBe("fearful");
    expect(shortTestTypeBySlug(t, "nope")).toBeNull();
  });
});

test("getShortTest returns null for unknown slug", () => {
  expect(getShortTest("nope")).toBeNull();
});
