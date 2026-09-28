import rawArticles from "./generated/articles.json";
import raw from "./generated/library.json";
import { parseArticles, publishedArticles, type Article } from "./articles";
import { parseLibrary, type Library } from "./library";

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
