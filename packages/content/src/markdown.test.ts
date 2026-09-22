import { describe, expect, it } from "vitest";
import { inlineLinks, parseBlocks } from "./markdown";

describe("parseBlocks", () => {
  it("splits text into headings, paragraphs and lists", () => {
    const text = "## Какие они\n\nПервый абзац\nпродолжается.\n\n- один\n- два\r\n\r\nПоследний.";
    expect(parseBlocks(text)).toEqual([
      { kind: "h2", text: "Какие они" },
      { kind: "p", text: "Первый абзац продолжается." },
      { kind: "ul", items: ["один", "два"] },
      { kind: "p", text: "Последний." },
    ]);
  });

  it("treats plain text as one paragraph and ignores extra blank lines", () => {
    expect(parseBlocks("\n\nОдин абзац.\n\n\n")).toEqual([{ kind: "p", text: "Один абзац." }]);
  });
});

describe("inlineLinks", () => {
  it("turns internal markdown links into parts and leaves external ones as text", () => {
    expect(inlineLinks("См. [тест](/test) и [сайт](https://example.com).")).toEqual([
      { text: "См. " },
      { text: "тест", href: "/test" },
      { text: " и [сайт](https://example.com)." },
    ]);
  });

  it("handles a link at the very start and several links", () => {
    expect(inlineLinks("[А](/a) и [Б](/b)")).toEqual([{ text: "А", href: "/a" }, { text: " и " }, { text: "Б", href: "/b" }]);
    expect(inlineLinks("без ссылок")).toEqual([{ text: "без ссылок" }]);
  });

  it("marks **bold** text", () => {
    expect(inlineLinks("**Открытость** — это [черта](/traits/openness-high).")).toEqual([
      { text: "Открытость", strong: true },
      { text: " — это " },
      { text: "черта", href: "/traits/openness-high" },
      { text: "." },
    ]);
  });
});
