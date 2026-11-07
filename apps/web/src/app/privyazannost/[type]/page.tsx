import { getShortTest, shortTestTypeBySlug } from "@grani/content/short-tests";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { publicMetadata, webPageJsonLd } from "@/lib/seo";
import styles from "../privyazannost.module.css";

const TEST = getShortTest("attachment")!;

export const dynamicParams = false;

export function generateStaticParams() {
  return TEST.types.map((type) => ({ type: type.slug }));
}

type Props = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = shortTestTypeBySlug(TEST, (await params).type);
  if (!type) return {};
  return publicMetadata({ title: type.page.title, description: type.page.description, path: `${TEST.path}/${type.slug}` });
}

export default async function AttachmentTypePage({ params }: Props) {
  const type = shortTestTypeBySlug(TEST, (await params).type);
  if (!type) notFound();
  const path = `${TEST.path}/${type.slug}`;
  const others = TEST.types.filter((other) => other.key !== type.key);
  return (
    <main className={`inner-page ${styles.page}`} data-palette="pair">
      <JsonLd data={webPageJsonLd({ title: type.page.title, description: type.page.description, path })} />
      <div className={styles.container}>
        <Breadcrumbs items={[{ name: TEST.h1, path: TEST.path }, { name: type.name, path }]} />
        <header className={styles.header}>
          <h1 className={styles.title}>{type.name}</h1>
          <p className={styles.lead}>{type.tagline}</p>
          <p>
            <Link className="button" href={TEST.path}>
              Пройти тест на тип привязанности <span aria-hidden="true">→</span>
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
          <p className={styles.disclaimer}>{TEST.disclaimer}</p>
          <section>
            <h2>Другие типы привязанности</h2>
            <ul className={styles.types}>
              {others.map((other) => (
                <li key={other.key}>
                  <Link href={`${TEST.path}/${other.slug}`}>{other.name}</Link>
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
