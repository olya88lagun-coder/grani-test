import rawArticles from "./generated/articles.json";
import raw from "./generated/library.json";
import { parseArticles, type Article } from "./articles";
import { parseLibrary, type Library } from "./library";

let cached: Library | undefined;

export function getLibrary(): Library {
  cached ??= parseLibrary(raw);
  return cached;
}

let articles: readonly Article[] | undefined;

export function getArticles(): readonly Article[] {
  articles ??= parseArticles(rawArticles);
  return articles;
}
