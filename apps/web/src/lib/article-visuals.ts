import type { Article } from "@grani/content";

// Рубрика, индивидуальная обложка и alt берутся из front matter статьи.
// Старые светлые картинки (листья, облака, атриум) по-прежнему заменяются ночными fallback-обложками.
export type ArticleVisual = { tag: string; image: string; imageAlt: string };

// Несколько обложек на рубрику: вариант выбирается по slug, поэтому карточки в одном ряду не повторяются
// и каждая статья всегда получает одну и ту же картинку.
export const COVERS_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  Личность: ["/home/article-extrovert.webp"],
  Психология: ["/home/article-friends.webp"],
  Отношения: ["/home/article-relationship.webp"],
  Наука: ["/home/cover-science.webp", "/home/article-friends.webp"],
  Работа: ["/home/cover-work.webp"],
};
export const DEFAULT_COVERS: readonly string[] = ["/home/cover-default.webp"];

const NIGHT_COVERS: ReadonlySet<string> = new Set([...Object.values(COVERS_BY_TAG).flat(), ...DEFAULT_COVERS]);

const FALLBACK_TAG = "Статья";

function variantFor(covers: readonly string[], slug: string): string {
  const hash = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return covers[hash % covers.length] ?? DEFAULT_COVERS[0]!;
}

export function articleCover(article: Article): string {
  if (article.image?.startsWith("/images/articles/")) return article.image;
  if (article.image && NIGHT_COVERS.has(article.image)) return article.image;
  const covers = (article.tag ? COVERS_BY_TAG[article.tag] : undefined) ?? DEFAULT_COVERS;
  return variantFor(covers, article.slug);
}

export type ArticleCard = { slug: string; title: string; description: string; date: string } & ArticleVisual;

export function articleCard(article: Article): ArticleCard {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date,
    tag: article.tag ?? FALLBACK_TAG,
    image: articleCover(article),
    imageAlt: article.imageAlt ?? "",
  };
}
