import { existsSync } from "node:fs";
import type { Article } from "@grani/content";
import { describe, expect, it } from "vitest";
import { articleCard, articleCover, COVERS_BY_TAG, DEFAULT_COVERS } from "./article-visuals";

const base = { slug: "a", title: "T", description: "D", date: "2026-10-01", body: "" } as unknown as Article;
const article = (patch: Record<string, unknown>) => ({ ...base, ...patch }) as Article;

describe("article covers", () => {
  it("uses the cover of the tag", () => {
    expect(articleCover(article({ tag: "Отношения" }))).toBe(COVERS_BY_TAG["Отношения"]![0]);
    expect(articleCover(article({ tag: "Психология" }))).toBe(COVERS_BY_TAG["Психология"]![0]);
  });

  it("ignores the legacy light pictures that the article writer used to pick", () => {
    for (const image of ["/home/type-architect.webp", "/home/hero-atrium.webp", "/home/type-iskra.webp"]) {
      expect(articleCover(article({ tag: "Личность", image }))).toBe(COVERS_BY_TAG["Личность"]![0]);
    }
  });

  it("keeps a night cover that the article names itself", () => {
    const own = COVERS_BY_TAG["Отношения"]![0]!;
    expect(articleCover(article({ tag: "Личность", image: own }))).toBe(own);
  });

  it("falls back to a default cover for an unknown or missing tag", () => {
    expect(DEFAULT_COVERS).toContain(articleCover(article({ tag: "Что-то новое" })));
    expect(DEFAULT_COVERS).toContain(articleCover(article({})));
  });

  it("picks the same variant for the same slug and spreads slugs over variants", () => {
    const variants = COVERS_BY_TAG["Наука"]!;
    expect(variants.length).toBeGreaterThan(1);
    expect(articleCover(article({ tag: "Наука", slug: "x" }))).toBe(articleCover(article({ tag: "Наука", slug: "x" })));
    const used = new Set(["a", "b", "c", "d", "e", "f", "g"].map((slug) => articleCover(article({ tag: "Наука", slug }))));
    expect(used.size).toBeGreaterThan(1);
  });

  it("only refers to cover files that exist", () => {
    for (const cover of [...Object.values(COVERS_BY_TAG).flat(), ...DEFAULT_COVERS]) {
      expect(existsSync(new URL(`../../public${cover}`, import.meta.url)), cover).toBe(true);
    }
  });

  it("gives the card the cover and keeps the tag", () => {
    const card = articleCard(article({ tag: "Наука", slug: "q" }));
    expect(card.tag).toBe("Наука");
    expect(card.image).toBe(articleCover(article({ tag: "Наука", slug: "q" })));
  });
});
