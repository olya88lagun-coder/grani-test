import type { Article } from "@grani/content";

// Рубрика и иллюстрация карточки берутся из front matter статьи (tag, image) — новые статьи конвейера приносят их сами
export type ArticleVisual = { tag: string; image: string };

const FALLBACK_VISUAL: ArticleVisual = { tag: "Статья", image: "/home/hero-atrium.webp" };

export type ArticleCard = { slug: string; title: string; description: string; date: string } & ArticleVisual;

export function articleCard(article: Article): ArticleCard {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date,
    tag: article.tag ?? FALLBACK_VISUAL.tag,
    image: article.image ?? FALLBACK_VISUAL.image,
  };
}
