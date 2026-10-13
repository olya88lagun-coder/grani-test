import { parsePortrait } from "@grani/ai";
import { samplePortrait } from "@grani/ai/testing";
import { portraitSeeds } from "@grani/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PortraitBlocks } from "./PortraitBlocks";

const sections = () => {
  const answer = samplePortrait();
  const built = parsePortrait({ version: 1, headline: answer.headline, blocks: answer.blocks.map((block, index) => ({ ...block, title: portraitSeeds()[index]!.title })) });
  if (!built) throw new Error("fixture is not a valid portrait");
  return built;
};

describe("PortraitBlocks", () => {
  test("shows the headline and five titled blocks, with the reading anchor", () => {
    const html = renderToStaticMarkup(<PortraitBlocks sections={sections()} />);

    expect(html).toContain("data-portrait-blocks");
    expect(html).toContain('id="edition-reading"');
    expect(html).toContain(samplePortrait().headline);
    expect(html.match(/<article/g)).toHaveLength(5);
    for (const seed of portraitSeeds()) expect(html).toContain(seed.title);
    for (const block of samplePortrait().blocks) expect(html).toContain(block.text.slice(0, 40));
  });

  test("escapes the model text", () => {
    const evil = sections();
    const html = renderToStaticMarkup(<PortraitBlocks sections={{ ...evil, headline: `${evil.headline} <script>x</script>` }} />);

    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
