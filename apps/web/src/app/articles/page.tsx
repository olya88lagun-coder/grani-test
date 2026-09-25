import { getArticles } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { articleCard } from "@/lib/article-visuals";
import { articleDate, publicMetadata } from "@/lib/seo";
import { ArticleGrid } from "./ArticleGrid";

export const metadata = publicMetadata({
  title: "Статьи о личности и отношениях",
  description: "Статьи о модели «Большая пятёрка»: как устроены черты характера, чем интроверт отличается от застенчивого, как нас видят друзья и что важно для совместимости пары.",
  path: "/articles",
});

// Главная статья журнала — про саму модель; остальные идут сеткой с фильтром по рубрикам
const FEATURED_SLUG = "big-five";

export default function ArticlesPage() {
  const cards = getArticles().map(articleCard);
  const featured = cards.find((card) => card.slug === FEATURED_SLUG) ?? cards[0];
  const rest = cards.filter((card) => card !== featured);
  const dates = Object.fromEntries(cards.map((card) => [card.slug, articleDate(card.date)]));

  return (
    <main className="inner-page inner-page--articles">
      <div className="page page--wide stack">
        <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }]} />
        <header className="journal-hero">
          <p className="eyebrow">Журнал «Граней»</p>
          <h1 className="display">Статьи</h1>
          <p className="lead">О личности, отношениях и том, как нас видят другие. Психология — просто, глубоко и по делу.</p>
        </header>

        {featured && (
          <Link className="journal-featured" href={`/articles/${featured.slug}`}>
            <div className="journal-featured__body">
              <span className="article-badge">{featured.tag}</span>
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
              <p className="article-tile__meta">
                {dates[featured.slug]} <span aria-hidden="true">→</span>
              </p>
            </div>
            <img className="journal-featured__image" src={featured.image} alt="" />
          </Link>
        )}

        <section className="journal-list stack" aria-labelledby="all-articles">
          <h2 id="all-articles">Все статьи</h2>
          <ArticleGrid articles={rest} dates={dates} />
        </section>

        <TestCta />
      </div>
    </main>
  );
}
