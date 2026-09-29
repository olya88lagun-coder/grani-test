import rawArticles from "./generated/articles.json";
import rawGuides from "./generated/trait-guides.json";
import raw from "./generated/library.json";
import { parseArticles, publishedArticles, type Article } from "./articles";
import { parseLibrary, type Library } from "./library";
import { parseTraitGuides, type TraitGuide } from "./trait-guides";

let cached: Library | undefined;

export function getLibrary(): Library {
  cached ??= parseLibrary(raw);
  return cached;
}

let articles: readonly Article[] | undefined;

export function getAllArticles(): readonly Article[] {
  articles ??= parseArticles(rawArticles);
  return articles;
}

export function getArticles(): readonly Article[] {
  return publishedArticles(getAllArticles());
}

let guides: ReadonlyMap<string, TraitGuide> | undefined;

// Гид по полюсу черты по слагу страницы (openness-high и т. п.)
export function getTraitGuide(slug: string): TraitGuide | null {
  guides ??= new Map(parseTraitGuides(rawGuides).map((guide) => [guide.slug, guide]));
  return guides.get(slug) ?? null;
}
