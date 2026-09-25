"use client";

import { useState } from "react";
import { ArticleTile } from "@/components/ArticleTile";
import type { ArticleCard } from "@/lib/article-visuals";

const ALL = "Все темы";

// Фильтр по рубрикам без смены адреса: все статьи всегда в HTML, кнопки только прячут лишние карточки
export function ArticleGrid({ articles, dates }: { articles: readonly ArticleCard[]; dates: Readonly<Record<string, string>> }) {
  const tags = [ALL, ...new Set(articles.map((article) => article.tag))];
  const [active, setActive] = useState(ALL);
  const shown = active === ALL ? articles : articles.filter((article) => article.tag === active);

  return (
    <>
      <div className="article-tags" role="group" aria-label="Рубрики">
        {tags.map((tag) => (
          <button key={tag} type="button" className="article-tag" aria-pressed={tag === active} onClick={() => setActive(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <ul className="article-grid">
        {shown.map((article) => (
          <li key={article.slug}>
            <ArticleTile article={article} date={dates[article.slug] ?? ""} level={3} />
          </li>
        ))}
      </ul>
    </>
  );
}
