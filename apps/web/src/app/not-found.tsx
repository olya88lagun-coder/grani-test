import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { ArticleTile } from "@/components/ArticleTile";
import { articleCard } from "@/lib/article-visuals";
import { articleDate } from "@/lib/seo";

export const metadata: Metadata = { title: "Страница не найдена" };

const SUGGESTED_ARTICLES = 3;

// Неизвестный адрес отдаёт настоящий 404, но не тупик: тест, главная и свежие статьи
export default function NotFound() {
  const articles = getArticles().slice(0, SUGGESTED_ARTICLES).map(articleCard);
  return (
    <main className="inner-page">
      <div className="page page--wide stack">
        <header className="journal-hero not-found-hero">
          <p className="eyebrow">Ошибка 404</p>
          <h1 className="display">Такой страницы нет</h1>
          <p className="lead">Возможно, адрес набран с ошибкой или страница переехала. Зато тест на месте.</p>
          <p className="row">
            <Link className="button" href="/test">
              Пройти тест <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button--ghost" href="/">
              На главную
            </Link>
          </p>
        </header>
        {articles.length > 0 && (
          <section className="stack" aria-labelledby="not-found-articles">
            <h2 id="not-found-articles">Почитать</h2>
            <ul className="article-grid">
              {articles.map((article) => (
                <li key={article.slug}>
                  <ArticleTile article={article} date={articleDate(article.date)} level={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
