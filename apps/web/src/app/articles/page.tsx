import { getArticles } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { articleDate, publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Статьи о личности и отношениях",
  description: "Статьи о модели «Большая пятёрка»: как устроены черты характера, чем интроверт отличается от застенчивого, как нас видят друзья и что важно для совместимости пары.",
  path: "/articles",
});

export default function ArticlesPage() {
  return (
    <main className="page inner-text">
      <div className="stack">
        <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }]} />
        <h1 className="display">Статьи</h1>
        <ul className="article-list">
          {getArticles().map((article) => (
            <li key={article.slug} className="card card--paper stack">
              <h2>
                <Link href={`/articles/${article.slug}`}>{article.title}</Link>
              </h2>
              <p>{article.description}</p>
              <p className="muted">{articleDate(article.date)}</p>
            </li>
          ))}
        </ul>
        <TestCta />
      </div>
    </main>
  );
}
