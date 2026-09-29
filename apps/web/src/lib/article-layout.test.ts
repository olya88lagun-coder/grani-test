import { describe, expect, it } from "vitest";
import { splitForInlineCta } from "./article-layout";

describe("splitForInlineCta", () => {
  it("puts the call to action before the third section, after the reader is engaged", () => {
    const body = "Вступление.\n\n## Первый\n\nА.\n\n## Второй\n\nБ.\n\n## Третий\n\nВ.";
    expect(splitForInlineCta(body)).toEqual(["Вступление.\n\n## Первый\n\nА.\n\n## Второй\n\nБ.", "## Третий\n\nВ."]);
  });

  it("falls back to the second section in a short article", () => {
    expect(splitForInlineCta("Вступление.\n\n## Первый\n\nА.\n\n## Второй\n\nБ.")).toEqual(["Вступление.\n\n## Первый\n\nА.", "## Второй\n\nБ."]);
  });

  it("leaves an article without sections whole", () => {
    expect(splitForInlineCta("Только текст.")).toBeNull();
  });
});
