import { inlineLinks, type Article } from "@grani/content";

// Рубрика и иллюстрация карточки берутся из front matter статьи (tag, image) — новые статьи конвейера приносят их сами
export type ArticleVisual = { tag: string; image: string };

const FALLBACK_VISUAL: ArticleVisual = { tag: "Статья", image: "/home/hero-atrium.webp" };

export type ArticleCard = { slug: string; title: string; description: string; date: string; readingMinutes?: number } & ArticleVisual;

export function articleCard(article: Article): ArticleCard {
  const text = article.blocks.flatMap((block) => block.kind === "ul" ? block.items : [block.text])
    .flatMap(inlineLinks).map((part) => part.text).join(" ");
  // Ориентир для читателя, а не обещание длительности: 180 слов в минуту.
  const readingMinutes = Math.max(1, Math.ceil(text.trim().split(/\s+/u).length / 180));
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date,
    readingMinutes,
    tag: article.tag ?? FALLBACK_VISUAL.tag,
    image: article.image ?? FALLBACK_VISUAL.image,
  };
}
