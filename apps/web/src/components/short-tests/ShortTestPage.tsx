import { getShortTest, type ShortTestDefinition } from "@grani/content/short-tests";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd, publicMetadata, webPageJsonLd } from "@/lib/seo";
import { ShortTestRunner } from "./ShortTestRunner";
import styles from "./short-test-page.module.css";

export type RelatedLink = { href: string; label: string; text: string };
type HeroImage = { desktop: string; mobile: string; width: number; height: number };

type ShortTestPageProps = {
  slug: string;
  lead: string;
  facts: string;
  related: readonly RelatedLink[];
  palette?: string;
  heroImage?: HeroImage;
  showContents?: boolean;
};

const CONTENT_LINKS = [
  { id: "brief", label: "Кратко о темпераменте" },
  { id: "guide", label: "Как устроен тест" },
  { id: "types", label: "Четыре темперамента" },
  { id: "faq", label: "Вопросы и ответы" },
  { id: "sources", label: "Источники" },
] as const;

export function requireShortTest(slug: string): ShortTestDefinition {
  const test = getShortTest(slug);
  if (!test) throw new Error(`Unknown short test ${slug}`);
  return test;
}

export function shortTestPageMetadata(slug: string): Metadata {
  const test = requireShortTest(slug);
  return publicMetadata({ title: test.title, description: test.description, path: test.path });
}

// Страница короткого теста. Первый экран и раскладка — по дизайну Codex для /privyazannost (PR #180),
// вынесены сюда, чтобы все короткие тесты выглядели одинаково
export function ShortTestPage({ slug, lead, facts, related, palette, heroImage, showContents }: ShortTestPageProps) {
  const test = requireShortTest(slug);
  const anchor = `${test.slug}-test`;
  return (
    <main className={showContents ? `${styles.landing} ${styles.editorial}` : styles.landing} data-palette={palette ?? "default"} data-night-entry>
      <JsonLd data={webPageJsonLd({ title: test.title, description: test.description, path: test.path })} />
      <JsonLd data={faqJsonLd(test.faq)} />
      <header className={heroImage ? `${styles.hero} ${styles.heroWithImage}` : styles.hero} data-band="night">
        <div className={styles.heroWrap}>
          <Breadcrumbs items={[{ name: test.h1, path: test.path }]} />
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 className={styles.title}>{test.h1}</h1>
              <p className={styles.heroLead}>{lead}</p>
              <a className={`button ${styles.heroAction}`} href={`#${anchor}`}>
                Пройти тест <span aria-hidden="true">→</span>
              </a>
              <p className={styles.facts}>{facts}</p>
            </div>
            {heroImage ? (
              <picture className={styles.heroPicture} aria-hidden="true">
                <source media="(max-width: 680px)" srcSet={heroImage.mobile} />
                <img src={heroImage.desktop} alt="" width={heroImage.width} height={heroImage.height} fetchPriority="high" />
              </picture>
            ) : (
              <div className={styles.heroArt} aria-hidden="true">
                <img src="/home/hero-gem.webp" alt="" width={900} height={900} fetchPriority="high" />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.test} id={anchor} tabIndex={-1}>
          <ShortTestRunner slug={test.slug} />
        </div>
        {showContents && (
          <nav className={styles.contents} aria-label="На этой странице">
            <p>На этой странице</p>
            <ul>
              {CONTENT_LINKS.map(({ id, label }) => (
                <li key={id}><a href={`#${slug}-${id}`}>{label}</a></li>
              ))}
            </ul>
          </nav>
        )}
        <article className={styles.reading}>
          <section className={styles.brief} id={showContents ? `${slug}-brief` : undefined}>
            <h2>Кратко</h2>
            <p>{test.brief}</p>
          </section>

          {test.sections.map((section, index) => (
            <section key={section.heading} id={showContents && index === 0 ? `${slug}-guide` : undefined}>
              <h2>{section.heading}</h2>
              <p>{section.text}</p>
            </section>
          ))}

          <section id={showContents ? `${slug}-types` : undefined}>
            <h2>Все типы подробно</h2>
            <ul className={styles.types}>
              {test.types.map((type) => (
                <li key={type.key}>
                  <Link href={`${test.path}/${type.slug}`}>{type.name}</Link>
                  <span>{type.tagline}</span>
                </li>
              ))}
            </ul>
            {test.pairOffer && (
              <p>
                <Link href={`${test.path}/sochetaniya`}>Сочетания типов в паре: все десять</Link>
              </p>
            )}
          </section>

          <section id={showContents ? `${slug}-faq` : undefined}>
            <h2>Вопросы и ответы</h2>
            {test.faq.map((item) => (
              <details key={item.question} className={styles.faq}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>

          <section id={showContents ? `${slug}-sources` : undefined}>
            <h2>Источники</h2>
            <ol className={styles.sources}>
              {test.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ol>
          </section>

          <p className={styles.disclaimer}>{test.disclaimer}</p>

          <section className={styles.next}>
            <h2>Что ещё пройти</h2>
            <ul className={styles.types}>
              {related.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                  <span>{link.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
