import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CHAPTER_KINDS, formatRub, PRODUCT_PRICES } from "@grani/core";
import type { ReportPageView } from "@/lib/report-view";
import { chapterCoverSlug } from "@/lib/chapter-cover";
import { buildPersonalityAtlas } from "@/lib/personality-atlas";
import { initialAtlasData } from "@/server/personality-atlas-service";
import { PersonalEdition } from "./PersonalEdition";

const model = buildPersonalityAtlas({ openness: 78, conscientiousness: 48, extraversion: 50, agreeableness: 78, stability: 88 });
const full = { portrait: "Портрет", strengths: ["Опора"], blind_spots: [{ text: "Наблюдение", tip: "Совет" }], manual: { work: ["Работа"], fight: ["Разговор"], annoys: ["Предпочтения"] } };
const view: ReportPageView = {
  full,
  life: null,
  friends: { state: "waiting", counter: "0 из 3" },
  chapters: CHAPTER_KINDS.map((kind) => ({ kind, title: kind, state: "available", price: formatRub(PRODUCT_PRICES[kind]) })),
  bundle: { price: formatRub(PRODUCT_PRICES.chapters_all) },
  preparing: false,
};

describe("sphere cards", () => {
  test("every sphere card shows the cover of its chapter instead of the small gem", () => {
    const html = renderToStaticMarkup(
      <PersonalEdition resultId="r" displayName="Тест" typeName="Искра" model={model} view={view} moneyPracticeAvailable={false} initialDraft={{ revision: 0, updatedAt: null, data: initialAtlasData(model) }} />,
    );

    for (const kind of CHAPTER_KINDS) expect(html).toContain(`data-thumb="${chapterCoverSlug(kind)}"`);
    expect(html.match(/data-thumb=/g)).toHaveLength(4);
    expect(html).not.toContain("/gems/");
  });
});
