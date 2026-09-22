import { getLibrary } from "@grani/content/data";
import type { ReportRecord } from "@grani/db";
import { describe, expect, test } from "vitest";
import { buildPersonalInput, fallbackSections } from "@grani/ai";
import { buildReportPageView, buildReportPreview } from "./report-view";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;

const report = (kind: ReportRecord["kind"], sections: unknown): ReportRecord => ({
  id: `${kind}-id`,
  resultId: "r1",
  pairId: null,
  kind,
  sections,
  source: "fallback",
  createdAt: new Date(),
});
const FULL = fallbackSections(buildPersonalInput(getLibrary(), "full", RESULT));
const MONEY = fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", RESULT));

describe("buildReportPreview", () => {
  test("shows the section titles with a short real beginning", () => {
    const preview = buildReportPreview(getLibrary(), RESULT);

    expect(preview.map((section) => section.title)).toEqual(["Портрет", "Сильные стороны", "Слепые зоны", "Инструкция по применению меня", "Как меня видят другие"]);
    for (const section of preview) expect(section.teaser.length).toBeLessThanOrEqual(121);
    expect(preview[0]!.teaser).not.toMatch(/\.…$/);
  });
});

describe("buildReportPageView", () => {
  test("a fresh purchase is being prepared, friends are counted", () => {
    const view = buildReportPageView({ owned: ["full"], reports: [], friendsCount: 1 });

    expect(view).toMatchObject({ full: null, friends: { state: "waiting", counter: "Ответили 1 из 3" }, bundle: { price: "249 ₽" }, preparing: true });
    expect(view.chapters.map((chapter) => chapter.state)).toEqual(["available", "available", "available", "available"]);
  });

  test("ready sections, a bought chapter and the friends section", () => {
    const view = buildReportPageView({
      owned: ["full", "chapter_money"],
      reports: [report("full", FULL), report("chapter_money", MONEY), report("friends", { text: "т".repeat(300) })],
      friendsCount: 3,
    });

    expect(view.full).toEqual(FULL);
    expect(view.friends).toEqual({ state: "ready", text: "т".repeat(300) });
    expect(view.chapters[0]).toMatchObject({ kind: "chapter_money", state: "ready" });
    expect(view.chapters[1]).toEqual({ kind: "chapter_conflict", title: "Конфликты", state: "available", price: "99 ₽" });
    expect(view.bundle).toBeNull();
    expect(view.preparing).toBe(false);
  });

  test("the bundle prepares all chapters, three friends without a text mean preparing", () => {
    const view = buildReportPageView({ owned: ["full", "chapters_all"], reports: [report("full", FULL)], friendsCount: 4 });

    expect(view.chapters.every((chapter) => chapter.state === "preparing")).toBe(true);
    expect(view.friends).toEqual({ state: "preparing" });
    expect(view.preparing).toBe(true);
  });
});
