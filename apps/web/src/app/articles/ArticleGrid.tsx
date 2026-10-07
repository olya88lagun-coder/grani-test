"use client";

import { useState } from "react";
import Link from "next/link";
import { ArticleTile } from "@/components/ArticleTile";
import type { ArticleCard } from "@/lib/article-visuals";
import styles from "./journal.module.css";

const ALL = "Все темы";

function articleCount(count: number) {
  const last = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  return `${count} ${!teen && last === 1 ? "статья" : !teen && last >= 2 && last <= 4 ? "статьи" : "статей"}`;
}

// Все материалы есть в первом HTML. Выбор рубрики меняет список без перехода.
export function ArticleGrid({ articles, dates, featured }: { articles: readonly ArticleCard[]; dates: Readonly<Record<string, string>>; featured?: ArticleCard }) {
  const tags = [ALL, ...new Set(articles.map((article) => article.tag))];
  const [active, setActive] = useState(ALL);
  const shown = active === ALL ? articles.filter((article) => article.slug !== featured?.slug) : articles.filter((article) => article.tag === active);
  const count = active === ALL ? articles.length : shown.length;

  return (
    <>
      <div className={styles.filtersRow}>
        <div className={styles.filters} role="group" aria-label="Рубрики">
          {tags.map((tag) => (
            <button key={tag} type="button" aria-pressed={tag === active} aria-controls="article-results" onClick={() => setActive(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <p className={styles.count} role="status" aria-live="polite" aria-atomic="true">{articleCount(count)}</p>
      </div>
      <div id="article-results">
        {active === ALL && featured && (
          <Link className={styles.featured} href={`/articles/${featured.slug}`}>
            <div className={styles.featuredBody}>
              <span className="article-badge">{featured.tag}</span>
              <h3>{featured.title}</h3>
              <p className={styles.featuredDescription}>{featured.description}</p>
              <p className={styles.featuredMeta}>{dates[featured.slug]}{featured.readingMinutes ? ` · ≈ ${featured.readingMinutes} мин` : ""} <span aria-hidden="true">→</span></p>
            </div>
            <img className={styles.featuredImage} src={featured.image} alt="" />
          </Link>
        )}
        <ul id="article-list" className={styles.grid}>
          {shown.map((article) => (
            <li key={article.slug}>
              <ArticleTile article={article} date={dates[article.slug] ?? ""} level={3} />
            </li>
          ))}
        </ul>
        {count === 0 && <p>Статей пока нет.</p>}
      </div>
    </>
  );
}
