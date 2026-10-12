import { buildPersonalInput, fallbackSections, parseChapterCards, type ChapterTextSections } from "@grani/ai";
import { sampleOverview, sampleSituation } from "@grani/ai/testing";
import { chapterSeeds } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ChapterView } from "@/lib/report-view";
import { ChapterReading } from "./ChapterReading";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const THEMES = chapterSeeds("chapter_money").map((seed) => seed.title);
const cards = parseChapterCards({ version: 2, ...sampleOverview(), situations: chapterSeeds("chapter_money").map(sampleSituation) })!;
const text = fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", { scores: SCORES, typeCode: "--++", stability: "sensitive" })) as ChapterTextSections;

function render(chapter: ChapterView, extra: { themes?: readonly string[]; practiceHref?: string } = {}) {
  return renderToStaticMarkup(
    <ChapterReading chapter={chapter} scores={SCORES} question="Что стоит за моими денежными привычками?" paperClassName="paper" preparing={<p>Готовим главу…</p>} {...extra} />,
  );
}

describe("ChapterReading", () => {
  test("a cards chapter is shown as cards with the compass link", () => {
    const html = render({ kind: "chapter_money", title: "Деньги", state: "ready", sections: cards }, { practiceHref: "/report/r/practice/money" });

    expect(html).toContain("Ты щедрее к людям, чем к себе");
    expect(html).toContain('href="/report/r/practice/money"');
    expect(html).not.toContain('class="paper"');
  });

  test("an old text chapter still shows its paragraphs and tips", () => {
    const html = render({ kind: "chapter_money", title: "Деньги", state: "ready", sections: text });

    expect(html).toContain('class="paper"');
    expect(html).toContain("Ориентиры для себя");
    expect(html).toContain(text.tips[0]!.slice(0, 30));
    expect(html).not.toContain("Главный вывод");
  });

  test("a chapter that is being prepared shows the waiting note", () => {
    expect(render({ kind: "chapter_money", title: "Деньги", state: "preparing" })).toContain("Готовим главу…");
  });

  test("an unbought chapter shows the question and the real themes, or no list without themes", () => {
    const available: ChapterView = { kind: "chapter_money", title: "Деньги", state: "available", price: "99 ₽" };
    const withThemes = render(available, { themes: THEMES });

    expect(withThemes).toContain("Что стоит за моими денежными привычками?");
    expect(withThemes).toContain("Что разберём");
    for (const title of THEMES) expect(withThemes).toContain(title);
    expect(render(available)).not.toContain("Что разберём");
  });
});
