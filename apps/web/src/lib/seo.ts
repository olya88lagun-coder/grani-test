import { ALL_TYPE_CODES, TRAITS, type Trait, type TypeCode } from "@grani/core";
import { PAGE_POLES, type PagePole, type Source } from "@grani/content";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import { OPERATOR } from "./legal";
import { traitPageTitle, typeDisplayName } from "./seo-pages";
import { SITE_NAME, SITE_URL } from "./site";

export { SITE_NAME, SITE_URL } from "./site";

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
    "/traits",
    ...TRAIT_PAGES.map((page) => `/traits/${page.slug}`),
    "/compatibility",
    "/articles",
    ...getArticles().map((article) => `/articles/${article.slug}`),
    "/about",
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

const LOGO_URL = `${SITE_URL}/icon.png`;
const COVER_URL = `${SITE_URL}${OG_IMAGE.url}`;

// Статья: Google требует картинку и издателя, чтобы показать её расширенным сниппетом
export function articleJsonLd(p: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  sources?: readonly Source[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.description,
    inLanguage: "ru",
    mainEntityOfPage: `${SITE_URL}${p.path}`,
    image: COVER_URL,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: LOGO_URL } },
    datePublished: p.datePublished,
    dateModified: p.dateModified ?? p.datePublished,
    ...(p.sources?.length
      ? { citation: p.sources.map((source) => ({ "@type": "ScholarlyArticle", name: source.title, url: source.url, datePublished: String(source.year) })) }
      : {}),
  };
}

// Справочные страницы типов и черт без даты — это страницы сайта, а не статьи
export function webPageJsonLd(p: { title: string; description: string; path: string; type?: "WebPage" | "AboutPage" }) {
  return {
    "@context": "https://schema.org",
    "@type": p.type ?? "WebPage",
    name: p.title,
    description: p.description,
    url: `${SITE_URL}${p.path}`,
    inLanguage: "ru",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    primaryImageOfPage: COVER_URL,
  };
}

// Главная: сайт и его издатель одним графом — Яндекс и Google берут отсюда название и логотип
export function siteJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE_NAME, url: SITE_URL, description, inLanguage: "ru" },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: LOGO_URL,
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: OPERATOR.email, availableLanguage: "ru" },
      },
    ],
  };
}

// Дата для lastmod в sitemap: у статей она есть, у остальных страниц честной даты правки нет — лучше не указывать
export function lastModified(path: string): string | undefined {
  const articles = getArticles();
  if (path === "/articles") return articles[0]?.date;
  return articles.find((article) => path === `/articles/${article.slug}`)?.date;
}

const LLMS_INTRO =
  "Грани — бесплатный онлайн-тест личности по модели «Большая пятёрка» (Big Five, OCEAN) на основе опросника IPIP-50. " +
  "50 утверждений дают профиль по пяти чертам и один из 16 типов. Друзья могут оценить человека по той же шкале — " +
  "так видно, как его видят другие. Есть тест совместимости пары.";

const llmsLink = (name: string, path: string) => `- [${name}](${SITE_URL}${path})`;

// Карта сайта для ИИ-ассистентов (llmstxt.org): что это за сайт и где лежат ключевые страницы
export function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    `> ${LLMS_INTRO}`,
    ["## Тест", llmsLink("Пройти тест", "/"), llmsLink("Совместимость пары", "/compatibility")].join("\n"),
    ["## 16 типов личности", llmsLink("Все типы", "/types"), ...ALL_TYPE_CODES.map((code) => llmsLink(typeDisplayName(code), typePath(code)))].join("\n"),
    ["## Черты Большой пятёрки", ...TRAIT_PAGES.map((page) => llmsLink(traitPageTitle(page.trait, page.pole), traitPath(page.trait, page.pole)))].join("\n"),
    ["## Статьи", ...getArticles().map((article) => llmsLink(article.title, `/articles/${article.slug}`))].join("\n"),
    ["## О проекте", llmsLink("О проекте и методике", "/about"), llmsLink("Контакты", "/contacts"), llmsLink("Оферта и цены", "/offer")].join("\n"),
  ].join("\n\n");
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
