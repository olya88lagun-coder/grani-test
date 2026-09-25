import { TRAITS } from "@grani/core";
import { ARTICLE_SOURCES, TRAIT_LABELS } from "@grani/content";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleTile } from "@/components/ArticleTile";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { SourceList } from "@/components/SourceList";
import { TestCta } from "@/components/TestCta";
import { articleCard } from "@/lib/article-visuals";
import { articleDate, articleJsonLd, publicMetadata, traitPath } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticles().map((article) => ({ slug: article.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const findArticle = (slug: string) => getArticles().find((article) => article.slug === slug) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = findArticle((await params).slug);
  if (!article) return {};
  const meta = publicMetadata({ title: article.seoTitle ?? article.title, description: article.description, path: `/articles/${article.slug}` });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: article.date } };
}

// Пять черт модели со ссылками на страницы обоих полюсов — общая опора для всех статей
function FiveTraits() {
  return (
    <section className="five-traits" aria-labelledby="five-traits">
      <div className="five-traits__head">
        <h2 id="five-traits">Пять черт</h2>
        <p>Пять шкал «Большой пятёрки» — у каждой два полюса.</p>
      </div>
      <ul>
        {TRAITS.map((trait) => (
          <li key={trait}>
            <span className="five-traits__name">{TRAIT_LABELS[trait]}</span>
            <span className="five-traits__links">
              <Link href={traitPath(trait, "high")}>высокая</Link>
              <span aria-hidden="true">·</span>
              <Link href={traitPath(trait, "low")}>низкая</Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ArticlePage({ params }: Props) {
  const article = findArticle((await params).slug);
  if (!article) notFound();
  const path = `/articles/${article.slug}`;
  const card = articleCard(article);
  const sources = ARTICLE_SOURCES[article.slug] ?? [];
  const others = getArticles()
    .filter((other) => other.slug !== article.slug)
    .map(articleCard);

  return (
    <main className="inner-page inner-page--article">
      <article className="page page--article stack">
        <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }, { name: article.title, path }]} />
        <header className="article-hero">
          <p className="article-hero__meta">
            <span className="article-badge">{card.tag}</span>
            <span>{articleDate(article.date)}</span>
          </p>
          <h1 className="display display--article">{article.title}</h1>
        </header>
        <img className="article-hero__image" src={card.image} alt="" />
        <blockquote className="article-insight">
          <p>{article.description}</p>
        </blockquote>
        <div className="article-body">
          <RichText text={article.body} />
        </div>
        <SourceList sources={sources} />
        <FiveTraits />
        <TestCta title="Узнай больше о себе" />
        <section className="stack" aria-labelledby="more">
          <h2 id="more">Другие статьи</h2>
          <ul className="article-grid article-grid--more">
            {others.map((other) => (
              <li key={other.slug}>
                <ArticleTile article={other} date={articleDate(other.date)} level={3} />
              </li>
            ))}
          </ul>
        </section>
        <JsonLd data={articleJsonLd({ title: article.title, description: article.description, path, datePublished: article.date, sources })} />
      </article>
    </main>
  );
}
