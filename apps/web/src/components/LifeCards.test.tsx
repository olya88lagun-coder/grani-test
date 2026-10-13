import { parseLifeCards } from "@grani/ai";
import { sampleSituation } from "@grani/ai/testing";
import { lifeSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LifeCards } from "./LifeCards";

const sections = () => {
  const built = parseLifeCards({ version: 1, situations: lifeSeeds().map(sampleSituation) });
  if (!built) throw new Error("fixture is not valid life cards");
  return built;
};

describe("LifeCards", () => {
  test("shows the heading, five numbered cards with every part and no chapter-only blocks", () => {
    const html = renderToStaticMarkup(<LifeCards sections={sections()} />);

    expect(html).toContain("data-life-cards");
    expect(html).toContain("Когда жизнь меняет условия");
    expect(html.match(/<article/g)).toHaveLength(5);
    for (const label of ["Узнаёшь себя?", "Почему так", "Что сказать", "Что сделать"]) expect(html.split(label)).toHaveLength(6);
    for (const number of ["01", "02", "03", "04", "05"]) expect(html).toContain(`>${number}</p>`);
    expect(html).not.toContain("Три ловушки");
    expect(html).not.toContain("Как это видят близкие");
  });

  test("shows the card texts and no icons while the icon files are not listed", () => {
    const html = renderToStaticMarkup(<LifeCards sections={sections()} />);

    expect(html).toContain("Ситуация: Планы внезапно изменились");
    expect(html).toContain("«Мне нужно время подумать, отвечу завтра.»");
    expect(html).not.toContain("<img");
  });
});
