import { getShortTest, type ShortTestDefinition } from "@grani/content/short-tests";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd, publicMetadata, webPageJsonLd } from "@/lib/seo";
import { ShortTestRunner } from "./ShortTestRunner";
import styles from "./short-test-page.module.css";

export type RelatedLink = { href: string; label: string; text: string };

export function requireShortTest(slug: string): ShortTestDefinition {
  const test = getShortTest(slug);
  if (!test) throw new Error(`Unknown short test ${slug}`);
  return test;
}

export function shortTestPageMetadata(slug: string): Metadata {
  const test = requireShortTest(slug);
  return publicMetadata({ title: test.title, description: test.description, path: test.path });
}

// Страница короткого теста: H1, «Кратко», сам тест, серверный текст для поиска, типы, FAQ, источники
export function ShortTestPage({ slug, facts, related, palette }: { slug: string; facts: string; related: readonly RelatedLink[]; palette?: string }) {
  const test = requireShortTest(slug);
  return (
    <main className={`inner-page ${styles.page}`} data-palette={palette}>
      <JsonLd data={webPageJsonLd({ title: test.title, description: test.description, path: test.path })} />
      <JsonLd data={faqJsonLd(test.faq)} />
      <div className={styles.container}>
        <Breadcrumbs items={[{ name: test.h1, path: test.path }]} />
        <header className={styles.header}>
          <h1 className={styles.title}>{test.h1}</h1>
          <p className={styles.facts}>{facts}</p>
          <div className={styles.brief}>
            <h2>Кратко</h2>
            <p>{test.brief}</p>
          </div>
        </header>

        <ShortTestRunner slug={test.slug} />

        <article className={styles.reading}>
          {test.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.text}</p>
            </section>
          ))}

          <section>
            <h2>Все типы подробно</h2>
            <ul className={styles.types}>
              {test.types.map((type) => (
                <li key={type.key}>
                  <Link href={`${test.path}/${type.slug}`}>{type.name}</Link>
                  <span>{type.tagline}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Вопросы и ответы</h2>
            {test.faq.map((item) => (
              <details key={item.question} className={styles.faq}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>

          <section>
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
