import { describe, expect, it } from "vitest";
import { collectArticles } from "../scripts/build-library.mjs";
import { parseArticle, parseArticles, publishedArticles } from "./articles";
import { getArticles, getAllArticles } from "./data";
import rawArticles from "./generated/articles.json";
import { LibraryError } from "./library";
import { inlineLinks } from "./markdown";
import { findStopWords } from "./safety";
import { ARTICLE_SOURCES } from "./sources";

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
    expect(article).toMatchObject({ slug: "demo", title: "Большая пятёрка: заголовок с двоеточием", date: "2026-09-22", status: "published", reviewed: true, canonical: "/articles/demo" });
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

  it("supports structured SEO fields and FAQ", () => {
    const article = parseArticle(
      "demo",
      RAW.replace(
        "date: 2026-09-22",
        "date: 2026-09-22\nstatus: ready_for_review\nreviewed: false\ncanonical: /articles/demo\ncluster: big-five\nintent: informational\nfaq: Что это значит? => Это короткий ответ для будущего FAQ-блока статьи. || Как читать результат? => Нужно связать текст с тестом и не делать медицинских выводов.",
      ),
      SHORT,
    );
    expect(article.status).toBe("ready_for_review");
    expect(article.reviewed).toBe(false);
    expect(article.cluster).toBe("big-five");
    expect(article.faq).toHaveLength(2);
  });

  it("requires a manual review flag before explicit publication", () => {
    const explicitPublished = RAW.replace("date: 2026-09-22", "date: 2026-09-22\nstatus: published");
    expect(() => parseArticle("needs-review", explicitPublished, SHORT)).toThrow(/reviewed: true/);
    expect(parseArticle("reviewed", explicitPublished.replace("status: published", "status: published\nreviewed: true"), SHORT).status).toBe("published");
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

  it("filters public articles by published status", () => {
    const draft = RAW.replace("date: 2026-09-22", "date: 2026-09-22\nstatus: draft");
    const live = RAW.replace("date: 2026-09-22", "date: 2026-09-22\nstatus: published\nreviewed: true");
    const body = `\n\n${"Текст. ".repeat(700)}\n\n## А\n\nx\n\n## Б\n\ny\n\n## В\n\nz`;
    expect(publishedArticles(parseArticles({ draft: draft + body, live: live + body })).map((article) => article.slug)).toEqual(["live"]);
  });
});

describe("articles", () => {
  it("articles.json matches articles/ — run `pnpm build:library` after editing texts", () => {
    expect(rawArticles).toEqual(collectArticles(ARTICLES_DIR.pathname.replace(/^\/([A-Za-z]:)/, "$1")));
  });

  // Статьи добавляет конвейер, поэтому счёт не фиксирован — только нижняя граница и уникальность
  it("has valid published articles with unique slugs and no stop topics", () => {
    const articles = getArticles();
    expect(articles.length).toBeGreaterThanOrEqual(8);
    expect(new Set(getAllArticles().map((article) => article.slug)).size).toBe(getAllArticles().length);
    expect(new Set(articles.map((article) => article.canonical)).size).toBe(articles.length);
    for (const article of articles) {
      const text = [article.title, article.description, article.body].join("\n");
      expect(article.status, article.slug).toBe("published");
      expect(findStopWords(text), article.slug).toEqual([]);
    }
  });

  // Без ручной вычитки научность держится на источниках: у каждой опубликованной статьи — минимум две сверенные работы
  it("backs every published article with at least two sources", () => {
    for (const article of getArticles()) {
      expect(ARTICLE_SOURCES[article.slug]?.length ?? 0, article.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every published article its own rubric and illustration and a date not in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const article of getArticles()) {
      expect(article.tag, article.slug).toBeTruthy();
      expect(article.image, article.slug).toBeTruthy();
      expect(article.date <= today, article.slug).toBe(true);
    }
  });

  // Шаблон «%s — Грани» добавляет 8 знаков; поисковики обрезают заголовок после ~60.
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
