import { inlineLinks, TRAIT_SOURCES, traitPageIntro } from "@grani/content";
import { getArticles, getLibrary, getTraitGuide } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleTile } from "@/components/ArticleTile";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Paragraphs } from "@/components/Paragraphs";
import { RichText } from "@/components/RichText";
import { SourceList } from "@/components/SourceList";
import { TestCta } from "@/components/TestCta";
import { articleCard } from "@/lib/article-visuals";
import { articleDate, faqJsonLd, firstSentences, publicMetadata, TRAIT_PAGES, traitPageBySlug, traitPath, typePath, webPageJsonLd } from "@/lib/seo";
import { oppositePole, traitPageTitle, typeDisplayName, typesWithPole } from "@/lib/seo-pages";

export const dynamicParams = false;

const RELATED_ARTICLES = 3;

export function generateStaticParams() {
  return TRAIT_PAGES.map((page) => ({ slug: page.slug }));
}

type Props = { params: Promise<{ slug: string }> };

function pageTexts(slug: string) {
  const page = traitPageBySlug(slug);
  if (!page) return null;
  const intro = traitPageIntro(getLibrary(), page.trait, page.pole);
  return { ...page, intro, guide: getTraitGuide(slug), title: traitPageTitle(page.trait, page.pole), description: firstSentences(intro, 160) };
}

// Статьи, которые сами ссылаются на эту черту (любой её полюс), — самые близкие по теме
function relatedArticles(trait: string) {
  const prefix = `/traits/${trait}-`;
  return getArticles()
    .filter((article) =>
      article.blocks
        .flatMap((block) => (block.kind === "ul" ? block.items : [block.text]))
        .flatMap(inlineLinks)
        .some((part) => "href" in part && part.href.startsWith(prefix)),
    )
    .slice(0, RELATED_ARTICLES)
    .map(articleCard);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageTexts((await params).slug);
  if (!page) return {};
  return publicMetadata({ title: `${page.title}: что это значит`, description: page.description, path: traitPath(page.trait, page.pole) });
}

export default async function TraitPage({ params }: Props) {
  const page = pageTexts((await params).slug);
  if (!page) notFound();
  const path = traitPath(page.trait, page.pole);
  const types = typesWithPole(page.trait, page.pole);
  const opposite = oppositePole(page.pole);
  const articles = relatedArticles(page.trait);
  const sources = TRAIT_SOURCES[page.trait] ?? [];

  return (
    <main className="page inner-text">
      <article className="stack">
        <Breadcrumbs items={[{ name: "Черты личности", path: "/traits" }, { name: page.title, path }]} />
        <p className="eyebrow">Черта личности · Большая пятёрка</p>
        <h1 className="display">{page.title}</h1>
        <Paragraphs text={page.intro} />
        {page.guide && (
          <div className="trait-guide">
            <RichText text={page.guide.body} />
          </div>
        )}
        <TestCta title="Узнать свой показатель" />
        {types.length > 0 ? (
          <section className="stack" aria-labelledby="types">
            <h2 id="types">Типы, у которых {page.title.toLowerCase()}</h2>
            <ul className="link-grid">
              {types.map((code) => (
                <li key={code}>
                  <Link href={typePath(code)}>{typeDisplayName(code)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p>
            Эмоциональная устойчивость не входит в код типа, а уточняет его: у каждого из <Link href="/types">16 типов</Link> есть спокойный и
            чувствительный вариант.
          </p>
        )}
        <p>
          <Link href={traitPath(page.trait, opposite)}>{traitPageTitle(page.trait, opposite)}</Link> — противоположный полюс этой черты.
        </p>
        {page.guide && (
          <section className="stack" aria-labelledby="faq">
            <h2 id="faq">Частые вопросы</h2>
            {page.guide.faq.map((item) => (
              <div className="card stack" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </section>
        )}
        {articles.length > 0 && (
          <section className="stack" aria-labelledby="related">
            <h2 id="related">Почитать по теме</h2>
            <ul className="article-grid">
              {articles.map((article) => (
                <li key={article.slug}>
                  <ArticleTile article={article} date={articleDate(article.date)} level={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <SourceList sources={sources} />
        <JsonLd data={webPageJsonLd({ title: page.title, description: page.description, path })} />
        {page.guide && <JsonLd data={faqJsonLd(page.guide.faq)} />}
      </article>
    </main>
  );
}
