import { existsSync } from "node:fs";
import type { Article } from "@grani/content";
import { getArticles } from "@grani/content/data";
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

  it("uses each article's dedicated editorial cover and alt text", () => {
    const expected = {
      "big-five": "01-big-five.webp",
      dobrosovestnost: "02-dobrosovestnost.webp",
      "nizkaya-otkrytost": "03-nizkaya-otkrytost.webp",
      "otkrytost-opytu": "04-otkrytost-opytu.webp",
      "naskolko-tochen-big-five": "05-tochnost-big-five.webp",
      "rezultaty-big-five": "06-rezultaty-big-five.webp",
      "ipip-50": "07-ipip-50.webp",
      ambivert: "08-ambivert.webp",
      "mbti-i-socionika": "09-mbti-socionika.webp",
      temperament: "10-temperament.webp",
      "ekstravert-introvert": "11-ekstravert-introvert.webp",
      "kak-menya-vidyat": "12-kak-menya-vidyat.webp",
      "sovmestimost-par": "13-sovmestimost-par.webp",
      "test-lichnosti": "14-test-lichnosti.webp",
    } as const;
    const cards = getArticles().map(articleCard);
    expect(cards).toHaveLength(14);
    for (const card of cards) {
      expect(card.image).toBe(`/images/articles/${expected[card.slug as keyof typeof expected]}`);
      expect(card.imageAlt.length, card.slug).toBeGreaterThan(20);
    }
    expect(new Set(cards.map((card) => card.image)).size).toBe(14);
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
    const card = articleCard(article({ tag: "Наука", slug: "q", imageAlt: "Научная композиция из изумрудных фигур" }));
    expect(card.tag).toBe("Наука");
    expect(card.image).toBe(articleCover(article({ tag: "Наука", slug: "q" })));
    expect(card.imageAlt).toBe("Научная композиция из изумрудных фигур");
  });
});
