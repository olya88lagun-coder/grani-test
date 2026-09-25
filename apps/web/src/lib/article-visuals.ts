import type { Article } from "@grani/content";

// Рубрика и иллюстрация статьи — ассеты главной из apps/web/public/home
export type ArticleVisual = { tag: string; image: string };

export const ARTICLE_VISUALS: Readonly<Record<string, ArticleVisual>> = {
  "big-five": { tag: "Личность", image: "/home/type-iskra.webp" },
  "test-lichnosti": { tag: "Наука", image: "/home/type-architect.webp" },
  "ekstravert-introvert": { tag: "Личность", image: "/home/article-extrovert.webp" },
  "kak-menya-vidyat": { tag: "Психология", image: "/home/article-friends.webp" },
  "sovmestimost-par": { tag: "Отношения", image: "/home/article-relationship.webp" },
  "mbti-i-socionika": { tag: "Наука", image: "/home/type-commander.webp" },
  temperament: { tag: "Личность", image: "/home/type-dreamer.webp" },
  ambivert: { tag: "Личность", image: "/home/type-support.webp" },
};

const FALLBACK_VISUAL: ArticleVisual = { tag: "Статья", image: "/home/hero-atrium.webp" };

export type ArticleCard = { slug: string; title: string; description: string; date: string } & ArticleVisual;

export function articleCard(article: Article): ArticleCard {
  const visual = ARTICLE_VISUALS[article.slug] ?? FALLBACK_VISUAL;
  return { slug: article.slug, title: article.title, description: article.description, date: article.date, ...visual };
}
