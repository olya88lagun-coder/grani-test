import { describe, expect, it } from "vitest";
import { collectArticles } from "../scripts/build-library.mjs";
import { parseArticle, parseArticles } from "./articles";
import { getArticles } from "./data";
import rawArticles from "./generated/articles.json";
import { LibraryError } from "./library";
import { inlineLinks } from "./markdown";
import { findStopWords } from "./safety";

const ARTICLES_DIR = new URL("../articles", import.meta.url);
const SHORT = { min: 10, max: 1000 };

const RAW = `---
title: Большая пятёрка: заголовок с двоеточием
description: Описание статьи длиной больше пятидесяти знаков, чтобы пройти проверку.
date: 2026-09-22
---

Первый абзац
продолжается на второй строке.

## Раздел

- один
- два`;

describe("parseArticle", () => {
  it("reads front matter, keeping colons inside the title, and splits the body", () => {
    const article = parseArticle("demo", RAW, SHORT);
    expect(article).toMatchObject({ slug: "demo", title: "Большая пятёрка: заголовок с двоеточием", date: "2026-09-22" });
    expect(article.blocks).toEqual([
      { kind: "p", text: "Первый абзац продолжается на второй строке." },
      { kind: "h2", text: "Раздел" },
      { kind: "ul", items: ["один", "два"] },
    ]);
  });

  it("reads an optional short title for search results", () => {
    expect(parseArticle("demo", RAW, SHORT)).not.toHaveProperty("seoTitle");
    const withSeo = RAW.replace("date:", "seoTitle: Большая пятёрка коротко\ndate:");
    expect(parseArticle("demo", withSeo, SHORT).seoTitle).toBe("Большая пятёрка коротко");
    expect(() => parseArticle("long-seo", RAW.replace("date:", `seoTitle: ${"я".repeat(53)}\ndate:`), SHORT)).toThrow(/seoTitle/);
  });

  it("names the file when front matter is missing or invalid", () => {
    expect(() => parseArticle("broken", "Просто текст", SHORT)).toThrow(/articles\/broken\.md: no front matter/);
    expect(() => parseArticle("bad-date", RAW.replace("2026-09-22", "вчера"), SHORT)).toThrow(/bad-date.*date/);
  });

  it("rejects bodies outside the length limits and articles with too few headings", () => {
    expect(() => parseArticle("short", RAW)).toThrow(LibraryError);
    expect(() => parseArticle("long", RAW, { min: 10, max: 20 })).toThrow(/body length/);
  });

  it("sorts articles newest first, then by slug", () => {
    const later = RAW.replace("2026-09-22", "2026-10-01");
    const body = `\n\n${"Текст. ".repeat(700)}\n\n## А\n\nx\n\n## Б\n\ny\n\n## В\n\nz`;
    const sorted = parseArticles({ b: RAW + body, a: RAW + body, c: later + body });
    expect(sorted.map((article) => article.slug)).toEqual(["c", "a", "b"]);
  });
});

describe("articles", () => {
  it("articles.json matches articles/ — run `pnpm build:library` after editing texts", () => {
    expect(rawArticles).toEqual(collectArticles(ARTICLES_DIR.pathname.replace(/^\/([A-Za-z]:)/, "$1")));
  });

  it("has five valid articles with unique slugs and no stop topics", () => {
    const articles = getArticles();
    expect(articles).toHaveLength(5);
    expect(new Set(articles.map((article) => article.slug)).size).toBe(5);
    for (const article of articles) {
      const text = [article.title, article.description, article.body].join("\n");
      expect(findStopWords(text), article.slug).toEqual([]);
    }
  });

  // Шаблон «%s — Грани» добавляет 8 знаков; поисковики обрезают заголовок после ~60
  it("keeps every search title within 52 characters", () => {
    for (const article of getArticles()) {
      expect((article.seoTitle ?? article.title).length, article.slug).toBeLessThanOrEqual(52);
    }
  });

  it("links only to internal pages, at least twice per article", () => {
    for (const article of getArticles()) {
      const links = article.blocks
        .flatMap((block) => (block.kind === "ul" ? block.items : [block.text]))
        .flatMap(inlineLinks)
        .filter((part) => "href" in part);
      expect(links.length, article.slug).toBeGreaterThanOrEqual(2);
      expect(article.body, article.slug).not.toMatch(/\]\(https?:/);
    }
  });
});
