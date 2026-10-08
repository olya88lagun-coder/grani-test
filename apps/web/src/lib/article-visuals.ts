import type { Article } from "@grani/content";

// Рубрика берётся из front matter статьи (tag), обложку подставляет сайт: автописатель картинку не выбирает.
// Поле image статьи учитывается, только если это одна из ночных обложек ниже; старые светлые картинки
// (листья, облака, атриум), которые писали прежние статьи, игнорируются.
export type ArticleVisual = { tag: string; image: string };

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
  };
}
