import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleReading } from "./ArticleReading";

describe("article reading navigation", () => {
  it("links every contents entry to a unique rendered heading across the inline test prompt", () => {
    const body = "Вступление.\n\n## Один\n\nПервый текст.\n\n## Повтор\n\nВторой текст.\n\n## Повтор\n\nТретий текст.\n\n## Четыре\n\nЧетвёртый текст.";
    const html = renderToStaticMarkup(<ArticleReading body={body} />);
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
    expect(targets).toHaveLength(4);
    expect(new Set(targets).size).toBe(4);
    expect(targets).toEqual(ids);
    expect(html.indexOf("Второй текст.")).toBeLessThan(html.indexOf("Хочешь узнать"));
    expect(html.indexOf("Хочешь узнать")).toBeLessThan(html.indexOf("Третий текст."));
    for (const text of ["Вступление.", "Первый текст.", "Второй текст.", "Третий текст.", "Четвёртый текст."]) {
      expect(html.split(text)).toHaveLength(2);
    }
  });

  it("keeps short articles readable without adding a contents control", () => {
    const html = renderToStaticMarkup(<ArticleReading body="## Один\n\nТекст.\n\n## Два\n\nЕщё текст." />);
    expect(html).not.toContain("<details");
    expect(html).toContain("Текст.");
    expect(html).toContain("Ещё текст.");
  });

  it("supports Windows newlines and leaves literal headings outside the contents when they are paragraphs", () => {
    const html = renderToStaticMarkup(<ArticleReading body={"Начало.\r\n\r\n## Один\r\n\r\nА.\r\n\r\n## Два\r\n\r\nБ.\r\n\r\n## Три\r\n\r\nВ.\r\n\r\n## Четыре\r\n\r\nГ.\r\n\r\nЭто ## не заголовок."} />);
    expect([...html.matchAll(/href="#/g)]).toHaveLength(4);
    expect(html).toContain("Это ## не заголовок.");
  });
});
