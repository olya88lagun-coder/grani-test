import { getArticles } from "@grani/content/data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { articleCard } from "@/lib/article-visuals";
import { articleDate, publicMetadata } from "@/lib/seo";
import { ArticleGrid } from "./ArticleGrid";
import styles from "./journal.module.css";

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
  const dates = Object.fromEntries(cards.map((card) => [card.slug, articleDate(card.date)]));

  return (
    <main className={styles.page}>
      <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }]} />
      <header className={styles.journalHero}>
        <p className="eyebrow">Журнал «Граней»</p>
        <h1>Статьи</h1>
        <p className={styles.lead}>О личности, отношениях и том, как нас видят другие. Психология — просто, глубоко и по делу.</p>
      </header>

      <section className={styles.list} aria-labelledby="all-articles">
        <h2 id="all-articles">Все статьи</h2>
        <ArticleGrid articles={cards} dates={dates} featured={featured} />
      </section>

      <div className={styles.cta}><TestCta /></div>
    </main>
  );
}
