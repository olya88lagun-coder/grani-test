import { getArticles } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/RichText";
import { TestCta } from "@/components/TestCta";
import { articleDate, articleJsonLd, publicMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticles().map((article) => ({ slug: article.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const findArticle = (slug: string) => getArticles().find((article) => article.slug === slug) ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = findArticle((await params).slug);
  if (!article) return {};
  const meta = publicMetadata({ title: article.title, description: article.description, path: `/articles/${article.slug}` });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: article.date } };
}

export default async function ArticlePage({ params }: Props) {
  const article = findArticle((await params).slug);
  if (!article) notFound();
  const path = `/articles/${article.slug}`;
  const others = getArticles().filter((other) => other.slug !== article.slug);

  return (
    <main className="page">
      <article className="stack">
        <Breadcrumbs items={[{ name: "Статьи", path: "/articles" }, { name: article.title, path }]} />
        <h1 className="display display--article">{article.title}</h1>
        <p className="muted">{articleDate(article.date)}</p>
        <RichText text={article.body} />
        <TestCta />
        <section className="stack" aria-labelledby="more">
          <h2 id="more">Другие статьи</h2>
          <ul>
            {others.map((other) => (
              <li key={other.slug}>
                <Link href={`/articles/${other.slug}`}>{other.title}</Link>
              </li>
            ))}
          </ul>
        </section>
        <JsonLd data={articleJsonLd({ title: article.title, description: article.description, path, datePublished: article.date })} />
      </article>
    </main>
  );
}
