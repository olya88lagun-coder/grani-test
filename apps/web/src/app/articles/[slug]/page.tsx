import { TRAITS } from "@grani/core";
import { ARTICLE_SOURCES, parseBlocks, TRAIT_LABELS } from "@grani/content";
import { Fragment } from "react";
import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleTile } from "@/components/ArticleTile";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { ReadingContents } from "@/components/ReadingContents";
import { SourceList } from "@/components/SourceList";
import { TestCta } from "@/components/TestCta";
import { splitForInlineCta } from "@/lib/article-layout";
import { articleCard } from "@/lib/article-visuals";
import { articleDate, articleJsonLd, faqJsonLd, publicMetadata, traitPath } from "@/lib/seo";
import styles from "../journal.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticles().map((article) => ({ slug: article.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const findArticle = (slug: string) => getArticles().find((article) => article.slug === slug) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = findArticle((await params).slug);
  if (!article) return {};
  const meta = publicMetadata({ title: article.seoTitle ?? article.title, description: article.description, path: article.canonical });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: article.date } };
}

// Автор всех статей — редакция проекта: вымышленных экспертов не заводим
const AUTHOR = "Команда «Граней»";

function InlineCta() {
  return (
    <aside className={styles.inlineCta} aria-label="Пройти тест">
      <p>Хочешь узнать, как эти черты выражены у тебя?</p>
      <Link className="button" href="/test">
        Пройти тест Big Five <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

// Пять черт модели со ссылками на страницы обоих полюсов — общая опора для всех статей.
function FiveTraits() {
  return (
    <section className={styles.fiveTraits} aria-labelledby="five-traits">
        <h2 id="five-traits">Пять черт</h2>
        <p>Пять шкал «Большой пятёрки» — у каждой два полюса.</p>
      <ul>
        {TRAITS.map((trait) => (
          <li key={trait}>
            <span className={styles.traitName}>{TRAIT_LABELS[trait]}</span>
            <span className={styles.traitLinks}>
              <Link href={traitPath(trait, "high")} aria-label={`${TRAIT_LABELS[trait]} — высокая`}>высокая</Link>
              <span aria-hidden="true">·</span>
              <Link href={traitPath(trait, "low")} aria-label={`${TRAIT_LABELS[trait]} — низкая`}>низкая</Link>
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
  const path = article.canonical;
  const card = articleCard(article);
  const sources = ARTICLE_SOURCES[article.slug] ?? [];
  const parts = splitForInlineCta(article.body);
  const readingParts = (parts ?? [article.body]).map((text, index) => ({ text, prefix: `article-${index}` }));
  const sections = readingParts.flatMap((part) => parseBlocks(part.text).flatMap((block, index) =>
    block.kind === "h2" ? [{ id: `${part.prefix}-${index}`, title: block.text }] : [],
  ));
  const others = getArticles()
    .filter((other) => other.slug !== article.slug)
    .map(articleCard);

  return (
    <main className={`${styles.page} ${styles.article}`}>
      <article>
        <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }, { name: article.title, path }]} />
        <header className={styles.articleHero}>
          <div>
            <p className={styles.meta}>
              <span className="article-badge">{card.tag}</span>
              <span>≈ {card.readingMinutes} мин чтения</span>
            </p>
            <h1>{article.title}</h1>
            <p className={styles.byline}>
              {AUTHOR} · обновлено {articleDate(article.date)} · <Link href="/about">подробнее о методике</Link>
            </p>
            <p className={styles.lead}>{article.description}</p>
          </div>
          <img className={styles.cover} src={card.image} alt="" />
        </header>
        <div className={sections.length > 0 ? styles.reading : styles.readingWithoutContents}>
          <ReadingContents sections={sections} />
          <div className={styles.prose}>
            {readingParts.map((part, index) => (
              <Fragment key={part.prefix}>
                <RichText text={part.text} headingIdPrefix={part.prefix} />
                {parts && index === 0 && <InlineCta />}
              </Fragment>
            ))}
          </div>
        </div>
        {article.faq.length > 0 && (
          <section className={`${styles.narrow} ${styles.faq}`} aria-labelledby="article-faq">
            <h2 id="article-faq">Вопросы по теме</h2>
            {article.faq.map((item) => (
              <details key={item.question}>
                <summary><h3>{item.question}</h3></summary>
                <p>{item.answer}</p>
              </details>
            ))}
            <JsonLd data={faqJsonLd(article.faq)} />
          </section>
        )}
        <div className={styles.narrow}><SourceList sources={sources} /></div>
        <FiveTraits />
        <div className={styles.cta}><TestCta title="Узнай больше о себе" /></div>
        <section className={styles.more} aria-labelledby="more">
          <h2 id="more">Другие статьи</h2>
          <ul className={styles.grid}>
            {others.map((other) => (
              <li key={other.slug}>
                <ArticleTile article={other} date={articleDate(other.date)} level={3} />
              </li>
            ))}
          </ul>
        </section>
        <JsonLd data={articleJsonLd({ title: article.title, description: article.description, path, datePublished: article.date, sources, image: card.image })} />
      </article>
    </main>
  );
}
