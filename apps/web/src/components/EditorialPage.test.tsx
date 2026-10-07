import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialPage } from "./EditorialPage";

describe("editorial reading layout", () => {
  it("preserves dynamic document text and makes repeated headings individually reachable", () => {
    const price = "299 ₽";
    const html = renderToStaticMarkup(
      <EditorialPage title="Документ" path="/offer" document>
        <h1>Документ</h1><p>Редакция 4 от 7 октября.</p>
        <h2>Условия</h2><p>Стоимость {price}. <a href="/privacy">Политика</a>.</p>
        <h2 id="refund">Условия</h2><p>Возврат по заявлению.</p>
      </EditorialPage>,
    );
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain("refund");
    for (const id of ids) expect(html).toContain(`href="#${id}"`);
    expect(html).toContain("Стоимость 299 ₽.");
    expect(html).toContain('href="/privacy">Политика</a>.');
    expect(html.indexOf("Редакция 4 от 7 октября.")).toBeLessThan(html.indexOf("Стоимость 299 ₽."));
    expect(html.indexOf("Стоимость 299 ₽.")).toBeLessThan(html.indexOf("Возврат по заявлению."));
  });
});
