import { ALL_TYPE_CODES, TRAITS } from "@grani/core";
import { getArticles } from "@grani/content/data";
import { describe, expect, it } from "vitest";
import {
  articleDate,
  articleJsonLd,
  siteJsonLd,
  breadcrumbs,
  firstSentences,
  lastModified,
  llmsTxt,
  OG_IMAGE,
  PUBLIC_PATHS,
  publicMetadata,
  SITE_URL,
  TRAIT_PAGES,
  traitPageBySlug,
  traitPath,
  TYPE_SLUGS,
  typeBySlug,
  typePath,
  webPageJsonLd,
} from "./seo";
import { OPERATOR } from "./legal";

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
    expect(paths).toEqual(expect.arrayContaining(["/", "/types", "/types/vdokhnovitel", "/traits", "/traits/stability-low", "/compatibility"]));
    expect(paths).toEqual(expect.arrayContaining(["/about", "/privacy", "/consent", "/offer", "/contacts"]));
    expect(paths.filter((p) => p.startsWith("/types/"))).toHaveLength(16);
    expect(paths.filter((p) => p.startsWith("/traits/"))).toHaveLength(10);
    expect(paths.filter((p) => p.startsWith("/articles"))).toHaveLength(6);
    expect(paths).toHaveLength(41);
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

  it("gives public pages a large link preview with the site cover", () => {
    const meta = publicMetadata({ title: "Вдохновитель", description: "Описание типа", path: "/types/vdokhnovitel" });
    expect(meta.openGraph?.images).toEqual([OG_IMAGE]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [OG_IMAGE.url] });
    expect(OG_IMAGE).toMatchObject({ url: "/og/grani.jpg", width: 1200, height: 630 });
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

  it("builds a dated article with the cover image and the publisher", () => {
    expect(articleJsonLd({ title: "Т", description: "О", path: "/articles/big-five", datePublished: "2026-09-22" })).toMatchObject({
      "@type": "Article",
      headline: "Т",
      mainEntityOfPage: `${SITE_URL}/articles/big-five`,
      datePublished: "2026-09-22",
      dateModified: "2026-09-22",
      image: `${SITE_URL}${OG_IMAGE.url}`,
      publisher: { "@type": "Organization", name: "Грани", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` } },
    });
  });

  it("lists the scholarly sources of an article as citations", () => {
    const source = { authors: "Vazire S.", year: 2010, title: "Who knows what about a person?", journal: "JPSP", url: "https://doi.org/10.1037/a0017908", note: "…" };
    const data = articleJsonLd({ title: "Т", description: "О", path: "/articles/kak-menya-vidyat", datePublished: "2026-09-22", sources: [source] });
    expect(data.citation).toEqual([{ "@type": "ScholarlyArticle", name: "Who knows what about a person?", url: "https://doi.org/10.1037/a0017908", datePublished: "2010" }]);
    expect(articleJsonLd({ title: "Т", description: "О", path: "/articles/x", datePublished: "2026-09-22" })).not.toHaveProperty("citation");
  });

  it("marks the about page with its own schema type", () => {
    expect(webPageJsonLd({ title: "О проекте", description: "О", path: "/about", type: "AboutPage" })["@type"]).toBe("AboutPage");
  });

  it("describes a reference page as a web page of the site, not an article", () => {
    expect(webPageJsonLd({ title: "Искра", description: "О", path: "/types/iskra" })).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Искра",
      description: "О",
      url: `${SITE_URL}/types/iskra`,
      inLanguage: "ru",
      isPartOf: { "@type": "WebSite", name: "Грани", url: SITE_URL },
      primaryImageOfPage: `${SITE_URL}${OG_IMAGE.url}`,
    });
  });
});

describe("lastModified", () => {
  it("dates an article by its own date and the article list by the newest one", () => {
    const newest = getArticles()[0]!;
    expect(lastModified(`/articles/${newest.slug}`)).toBe(newest.date);
    expect(lastModified("/articles")).toBe(newest.date);
    expect(lastModified("/types/iskra")).toBeUndefined();
  });
});

describe("siteJsonLd", () => {
  it("describes the site and its publisher with a contact e-mail for the home page", () => {
    const data = siteJsonLd("Описание");
    expect(data["@graph"]).toEqual([
      expect.objectContaining({ "@type": "WebSite", url: SITE_URL, name: "Грани", description: "Описание", inLanguage: "ru" }),
      expect.objectContaining({
        "@type": "Organization",
        url: SITE_URL,
        name: "Грани",
        logo: `${SITE_URL}/icon.png`,
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: OPERATOR.email, availableLanguage: "ru" },
      }),
    ]);
  });
});

describe("llmsTxt", () => {
  it("lists the test, every type, trait and article with absolute links", () => {
    const text = llmsTxt();
    expect(text.startsWith("# Грани\n\n> ")).toBe(true);
    const links = [...text.matchAll(/\]\((https:[^)]+)\)/g)].map((match) => match[1]!);
    expect(links).toEqual(expect.arrayContaining([`${SITE_URL}/`, `${SITE_URL}/types/iskra`, `${SITE_URL}/traits/stability-low`, `${SITE_URL}/articles/big-five`]));
    expect(links.filter((link) => link.includes("/types/"))).toHaveLength(16);
    expect(links.filter((link) => link.includes("/traits/"))).toHaveLength(10);
    expect(links.every((link) => link.startsWith(SITE_URL))).toBe(true);
  });
});

describe("articleDate", () => {
  it("formats a date in Russian", () => {
    expect(articleDate("2026-09-22")).toBe("22 сентября 2026 г.");
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
