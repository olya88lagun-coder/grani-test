import { ALL_TYPE_CODES, TRAITS } from "@grani/core";
import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  breadcrumbs,
  firstSentences,
  PUBLIC_PATHS,
  publicMetadata,
  SITE_URL,
  TRAIT_PAGES,
  traitPageBySlug,
  traitPath,
  TYPE_SLUGS,
  typeBySlug,
  typePath,
} from "./seo";

describe("type slugs", () => {
  it("gives every type a unique latin slug that maps back to the type", () => {
    const slugs = ALL_TYPE_CODES.map((code) => TYPE_SLUGS[code]);
    expect(new Set(slugs).size).toBe(16);
    for (const code of ALL_TYPE_CODES) {
      expect(TYPE_SLUGS[code]).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(typeBySlug(TYPE_SLUGS[code])).toBe(code);
    }
    expect(typeBySlug("unknown")).toBeNull();
    expect(typePath("+-++")).toBe("/types/iskra");
  });
});

describe("trait pages", () => {
  it("has a high and a low page for each of the five traits", () => {
    expect(TRAIT_PAGES).toHaveLength(10);
    for (const trait of TRAITS) {
      expect(traitPageBySlug(`${trait}-high`)).toEqual({ slug: `${trait}-high`, trait, pole: "high" });
      expect(traitPageBySlug(`${trait}-low`)?.pole).toBe("low");
    }
    expect(traitPageBySlug("openness-borderline")).toBeNull();
    expect(traitPath("stability", "low")).toBe("/traits/stability-low");
  });
});

describe("PUBLIC_PATHS", () => {
  it("lists home, 16 types, 10 traits, compatibility and documents, but no private pages", () => {
    const paths = PUBLIC_PATHS();
    expect(paths).toEqual(expect.arrayContaining(["/", "/types", "/types/vdokhnovitel", "/traits/stability-low", "/compatibility"]));
    expect(paths).toEqual(expect.arrayContaining(["/privacy", "/consent", "/offer", "/contacts"]));
    expect(paths.filter((p) => p.startsWith("/types/"))).toHaveLength(16);
    expect(paths.filter((p) => p.startsWith("/traits/"))).toHaveLength(10);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.some((p) => /^\/(result|report|pair|p|f|me|test|login|purchases|cards|dev|api)(\/|$)/.test(p))).toBe(false);
  });
});

describe("metadata", () => {
  it("builds indexable metadata with a canonical url and open graph", () => {
    const meta = publicMetadata({ title: "Вдохновитель", description: "Описание типа", path: "/types/vdokhnovitel" });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe("/types/vdokhnovitel");
    expect(meta.openGraph).toMatchObject({ title: "Вдохновитель", description: "Описание типа", url: "/types/vdokhnovitel", locale: "ru_RU", siteName: "Грани" });
  });

  it("builds a schema.org breadcrumb list with absolute urls", () => {
    expect(breadcrumbs([{ name: "Типы", path: "/types" }, { name: "Искра", path: "/types/iskra" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Типы", item: `${SITE_URL}/types` },
        { "@type": "ListItem", position: 2, name: "Искра", item: `${SITE_URL}/types/iskra` },
      ],
    });
  });

  it("builds an article with an absolute page url and an optional date", () => {
    expect(articleJsonLd({ title: "Т", description: "О", path: "/articles/big-five", datePublished: "2026-09-22" })).toMatchObject({
      "@type": "Article",
      headline: "Т",
      mainEntityOfPage: `${SITE_URL}/articles/big-five`,
      datePublished: "2026-09-22",
    });
    expect(articleJsonLd({ title: "Т", description: "О", path: "/types" })).not.toHaveProperty("datePublished");
  });
});

describe("firstSentences", () => {
  it("keeps whole sentences while they fit", () => {
    expect(firstSentences("Первое предложение. Второе предложение.  Третье!", 40)).toBe("Первое предложение. Второе предложение.");
    expect(firstSentences("Коротко.", 160)).toBe("Коротко.");
  });

  it("cuts a too long first sentence by words and adds an ellipsis", () => {
    const cut = firstSentences("Очень длинное первое предложение, которое никак не помещается в лимит.", 30);
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut).toBe("Очень длинное первое…");
  });

  it("treats text without a full stop as one sentence", () => {
    expect(firstSentences("Без точки в конце", 160)).toBe("Без точки в конце…");
  });
});
