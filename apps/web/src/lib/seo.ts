import { ALL_TYPE_CODES, TRAITS, type Trait, type TypeCode } from "@grani/core";
import { PAGE_POLES, type PagePole } from "@grani/content";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";

export const SITE_URL = "https://grani-test.ru";
export const SITE_NAME = "Грани";

// Обложка для превью ссылок во ВКонтакте и мессенджерах; относительный адрес дополняется metadataBase
export const OG_IMAGE = { url: "/og/grani.jpg", width: 1200, height: 630, alt: "Грани — тест личности: узнай себя глубже" } as const;

// Транслитерация названия типа: Яндекс учитывает слова в адресе, а ссылка читается в мессенджере
export const TYPE_SLUGS: Readonly<Record<TypeCode, string>> = {
  "++++": "vdokhnovitel",
  "+++-": "reformator",
  "++-+": "sozidatel",
  "++--": "arkhitektor",
  "+-++": "iskra",
  "+-+-": "buntar",
  "+--+": "mechtatel",
  "+---": "izobretatel",
  "-+++": "opora",
  "-++-": "komandir",
  "-+-+": "tikhiy-khranitel",
  "-+--": "master",
  "--++": "dusha-kompanii",
  "--+-": "igrok",
  "---+": "tikhaya-gavan",
  "----": "nablyudatel",
};

const TYPE_BY_SLUG: ReadonlyMap<string, TypeCode> = new Map(ALL_TYPE_CODES.map((code) => [TYPE_SLUGS[code], code]));

export function typeBySlug(slug: string): TypeCode | null {
  return TYPE_BY_SLUG.get(slug) ?? null;
}

export function typePath(code: TypeCode): string {
  return `/types/${TYPE_SLUGS[code]}`;
}

export type TraitPage = { slug: string; trait: Trait; pole: PagePole };

export const TRAIT_PAGES: readonly TraitPage[] = TRAITS.flatMap((trait) => PAGE_POLES.map((pole) => ({ slug: `${trait}-${pole}`, trait, pole })));

export function traitPageBySlug(slug: string): TraitPage | null {
  return TRAIT_PAGES.find((page) => page.slug === slug) ?? null;
}

export function traitPath(trait: Trait, pole: PagePole): string {
  return `/traits/${trait}-${pole}`;
}

const DOCUMENT_PATHS = ["/contacts", "/offer", "/privacy", "/consent"] as const;

export function PUBLIC_PATHS(): string[] {
  return [
    "/",
    "/types",
    ...ALL_TYPE_CODES.map(typePath),
    ...TRAIT_PAGES.map((page) => `/traits/${page.slug}`),
    "/compatibility",
    "/articles",
    ...getArticles().map((article) => `/articles/${article.slug}`),
    ...DOCUMENT_PATHS,
  ];
}

export function publicMetadata(p: { title: string; description: string; path: string }): Metadata {
  return {
    title: p.title,
    description: p.description,
    robots: { index: true, follow: true },
    alternates: { canonical: p.path },
    openGraph: { title: p.title, description: p.description, url: p.path, type: "website", locale: "ru_RU", siteName: SITE_NAME, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [OG_IMAGE.url] },
  };
}

export function breadcrumbs(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  };
}

export function articleJsonLd(p: { title: string; description: string; path: string; datePublished?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.description,
    inLanguage: "ru",
    mainEntityOfPage: `${SITE_URL}${p.path}`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
  };
}

function cutByWords(text: string, max: number): string {
  let cut = "";
  for (const word of text.split(" ")) {
    const next = cut ? `${cut} ${word}` : word;
    if (next.length > max - 1) break;
    cut = next;
  }
  return `${cut.replace(/[,;:—-]+$/, "")}…`;
}

// Описание для поисковой выдачи: целые предложения, пока влезают; иначе первое предложение по словам
export function firstSentences(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?…]+[.!?…]+/g);
  if (!sentences) return flat.length <= max ? `${flat}…` : cutByWords(flat, max);
  let out = "";
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim();
    if (next.length > max) break;
    out = next;
  }
  return out || cutByWords(flat, max);
}

export function articleDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });
}
