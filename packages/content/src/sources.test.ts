import { describe, expect, it } from "vitest";
import { getArticles } from "./data";
import { ARTICLE_SOURCES, METHOD_SOURCES, sourceLabel } from "./sources";

const all = [...Object.values(ARTICLE_SOURCES).flat(), ...METHOD_SOURCES];

describe("sources", () => {
  it("gives every article at least two sources and nothing for unknown articles", () => {
    const slugs = getArticles().map((article) => article.slug);
    expect(Object.keys(ARTICLE_SOURCES).sort()).toEqual([...slugs].sort());
    for (const slug of slugs) expect(ARTICLE_SOURCES[slug]!.length, slug).toBeGreaterThanOrEqual(2);
  });

  // DOI-ссылка ведёт на саму публикацию и не ломается при переезде журнала на другой сайт
  it("links every source to its DOI and describes what it supports", () => {
    expect(METHOD_SOURCES.length).toBeGreaterThanOrEqual(4);
    for (const source of all) {
      expect(source.url, source.title).toMatch(/^https:\/\/doi\.org\/10\.\d{4,5}\/\S+$/);
      expect(source.year, source.title).toBeGreaterThan(1900);
      expect(source.note.length, source.title).toBeGreaterThan(20);
    }
  });

  it("formats a source as authors, year, title and journal", () => {
    expect(sourceLabel({ authors: "Vazire S.", year: 2010, title: "Who knows what about a person?", journal: "JPSP", url: "https://doi.org/10.1037/a0017908", note: "…" })).toBe(
      "Vazire S. (2010). Who knows what about a person? // JPSP",
    );
  });
});
