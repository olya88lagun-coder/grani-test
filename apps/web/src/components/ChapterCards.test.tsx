import { parseChapterCards, type ChapterCardsSections } from "@grani/ai";
import { sampleOverview, sampleSituation } from "@grani/ai/testing";
import { chapterSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ChapterCards } from "./ChapterCards";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const sections = (patch: (value: ChapterCardsSections) => ChapterCardsSections = (value) => value): ChapterCardsSections => {
  const built = parseChapterCards({ version: 2, ...sampleOverview(), situations: chapterSeeds("chapter_money").map(sampleSituation) });
  if (!built) throw new Error("fixture is not a valid chapter");
  return patch(built);
};

describe("ChapterCards", () => {
  test("shows the headline, six cards with every part, the people block and three traps", () => {
    const html = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(html).toContain("Ты щедрее к людям, чем к себе");
    expect(html.match(/<article/g)).toHaveLength(6);
    for (const label of ["Узнаёшь себя?", "Почему так", "Что сказать", "Что сделать", "Как это видят близкие", "Три ловушки"]) expect(html).toContain(label);
    expect(html).toContain("«Мне нужно время подумать, отвечу завтра.»");
    expect(html.match(/data-trap/g)).toHaveLength(3);
  });

  test("draws the three money axes with the reader's scores", () => {
    const html = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(html.match(/role="img"/g)).toHaveLength(3);
    expect(html).toContain("30 из 100");
    expect(html).toContain("Трудно отказать");
  });

  test("links to the finance compass only when the practice is available", () => {
    const withLink = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} practiceHref="/report/r1/practice/money" />);
    const without = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    expect(withLink).toContain('href="/report/r1/practice/money"');
    expect(without).not.toContain("/practice/money");
  });

  test("a money card shows the icon of its theme, other themes stay without a picture", () => {
    const html = renderToStaticMarkup(<ChapterCards kind="chapter_money" sections={sections()} scores={SCORES} />);

    for (const seed of chapterSeeds("chapter_money")) expect(html).toContain(`chapters%2Fmoney%2F${seed.id}.webp`);
    const stress = renderToStaticMarkup(<ChapterCards kind="chapter_stress" sections={sections()} scores={SCORES} />);
    expect(stress).not.toContain("chapters%2F");
  });

  test.each([["chapter_conflict", "Отстаиваю своё"], ["chapter_stress", "Восстанавливаюсь один"], ["chapter_relationships", "Нужно личное пространство"]] as const)("%s shows its own scales", (kind, label) => {
    const html = renderToStaticMarkup(<ChapterCards kind={kind} sections={sections()} scores={SCORES} />);

    expect(html).toContain(label);
    expect(html).not.toContain("Охотно пробую новое");
  });

  test.each(["chapter_conflict", "chapter_stress", "chapter_relationships"] as const)("%s cards show the icon of their own themes", (kind) => {
    const seeds = chapterSeeds(kind);
    const html = renderToStaticMarkup(<ChapterCards kind={kind} sections={sections((value) => ({ ...value, situations: value.situations.map((card, index) => ({ ...card, seed: seeds[index]!.id })) }))} scores={SCORES} />);
    const slug = kind.replace("chapter_", "");

    for (const seed of seeds) expect(html).toContain(`chapters%2F${slug}%2F${seed.id}.webp`);
  });

  test("model text is escaped, not interpreted as HTML", () => {
    const html = renderToStaticMarkup(
      <ChapterCards kind="chapter_money" sections={sections((value) => ({ ...value, headline: "<script>alert(1)</script> " + value.headline }))} scores={SCORES} />,
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
