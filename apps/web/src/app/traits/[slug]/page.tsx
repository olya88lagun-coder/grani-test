import { traitPageIntro } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Paragraphs } from "@/components/Paragraphs";
import { TestCta } from "@/components/TestCta";
import { articleJsonLd, firstSentences, publicMetadata, TRAIT_PAGES, traitPageBySlug, traitPath, typePath } from "@/lib/seo";
import { oppositePole, traitPageTitle, typeDisplayName, typesWithPole } from "@/lib/seo-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return TRAIT_PAGES.map((page) => ({ slug: page.slug }));
}

type Props = { params: Promise<{ slug: string }> };

function pageTexts(slug: string) {
  const page = traitPageBySlug(slug);
  if (!page) return null;
  const intro = traitPageIntro(getLibrary(), page.trait, page.pole);
  return { ...page, intro, title: traitPageTitle(page.trait, page.pole), description: firstSentences(intro, 160) };
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

  return (
    <main className="page">
      <article className="stack">
        <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }, { name: page.title, path }]} />
        <p className="eyebrow">Черта личности · Большая пятёрка</p>
        <h1 className="display">{page.title}</h1>
        <Paragraphs text={page.intro} />
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
        <TestCta title="Узнай свой уровень" />
        <JsonLd data={articleJsonLd({ title: page.title, description: page.description, path })} />
      </article>
    </main>
  );
}
