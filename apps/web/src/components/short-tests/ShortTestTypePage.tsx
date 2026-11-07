import { shortTestTypeBySlug } from "@grani/content/short-tests";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { publicMetadata, webPageJsonLd } from "@/lib/seo";
import { requireShortTest } from "./ShortTestPage";
import styles from "./short-test-page.module.css";

export function shortTestTypeParams(slug: string): { type: string }[] {
  return requireShortTest(slug).types.map((type) => ({ type: type.slug }));
}

export function shortTestTypeMetadata(slug: string, typeSlug: string): Metadata {
  const test = requireShortTest(slug);
  const type = shortTestTypeBySlug(test, typeSlug);
  if (!type) return {};
  return publicMetadata({ title: type.page.title, description: type.page.description, path: `${test.path}/${type.slug}` });
}

// Страница одного типа короткого теста: текст для поиска и ссылка на сам тест
export function ShortTestTypePage({ slug, typeSlug, palette }: { slug: string; typeSlug: string; palette?: string }) {
  const test = requireShortTest(slug);
  const type = shortTestTypeBySlug(test, typeSlug);
  if (!type) notFound();
  const path = `${test.path}/${type.slug}`;
  const others = test.types.filter((other) => other.key !== type.key);
  return (
    <main className={`inner-page ${styles.page}`} data-palette={palette}>
      <JsonLd data={webPageJsonLd({ title: type.page.title, description: type.page.description, path })} />
      <div className={styles.container}>
        <Breadcrumbs items={[{ name: test.h1, path: test.path }, { name: type.name, path }]} />
        <header className={styles.header}>
          <h1 className={styles.title}>{type.name}</h1>
          <p className={styles.lead}>{type.tagline}</p>
          <p>
            <Link className="button" href={test.path}>
              Пройти {test.h1.toLowerCase()} <span aria-hidden="true">→</span>
            </Link>
          </p>
        </header>
        <article className={styles.reading}>
          {type.page.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.text}</p>
            </section>
          ))}
          <p className={styles.disclaimer}>{test.disclaimer}</p>
          <section>
            <h2>Другие типы</h2>
            <ul className={styles.types}>
              {others.map((other) => (
                <li key={other.key}>
                  <Link href={`${test.path}/${other.slug}`}>{other.name}</Link>
                  <span>{other.tagline}</span>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
