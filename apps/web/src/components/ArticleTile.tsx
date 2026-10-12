import Link from "next/link";
import type { ArticleCard } from "@/lib/article-visuals";
import { ArticleCover } from "@/components/ArticleCover";

// Карточка статьи с иллюстрацией: список статей и «Другие статьи»
export function ArticleTile({ article, date, level = 2 }: { article: ArticleCard; date: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Link className="article-tile" data-band="night" href={`/articles/${article.slug}`}>
      <ArticleCover article={article} className="article-tile__image" sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw" />
      <div className="article-tile__body">
        <span className="article-badge">{article.tag}</span>
        <Heading className="article-tile__title">{article.title}</Heading>
        <p className="article-tile__text">{article.description}</p>
        <p className="article-tile__meta">
          {date} <span aria-hidden="true">→</span>
        </p>
      </div>
    </Link>
  );
}
