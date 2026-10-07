import { ALL_TYPE_CODES } from "@grani/core";
import { TRAIT_LABELS, typeCodeToDir, typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PersonalityReading } from "@/components/PersonalityReading";
import { TestCta } from "@/components/TestCta";
import { TypeGem } from "@/components/TypeGem";
import { firstSentences, publicMetadata, traitPath, TYPE_SLUGS, typeBySlug, typePath, webPageJsonLd } from "@/lib/seo";
import { POLE_WORDS, typeDisplayName, typePoles } from "@/lib/seo-pages";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import styles from "../../personality.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_TYPE_CODES.map((code) => ({ slug: TYPE_SLUGS[code] }));
}

type Props = { params: Promise<{ slug: string }> };

function pageTexts(slug: string) {
  const code = typeBySlug(slug);
  if (!code) return null;
  const texts = typeTexts(getLibrary(), code);
  return { code, texts, title: `${typeDisplayName(code)} — тип личности`, description: firstSentences(texts.short, 160) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageTexts((await params).slug);
  if (!page) return {};
  return publicMetadata({ title: page.title, description: page.description, path: typePath(page.code) });
}

export default async function TypePage({ params }: Props) {
  const page = pageTexts((await params).slug);
  if (!page) notFound();
  const { code, texts } = page;
  const visual = TYPE_VISUALS[typeCodeToDir(code)];
  if (!visual) notFound();
  const name = typeDisplayName(code);

  return (
    <main className={`${styles.page} ${styles.detail}`}>
      <article>
        <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }, { name, path: typePath(code) }]} />
        <header className={styles.typeHero} data-family={visual.family}>
          <div className={styles.typeTitle}>
            <span className={styles.symbol} data-family={visual.family}>
              <TypeGem shape={visual.shape} size={60} />
            </span>
            <div>
              <p className="eyebrow">Тип личности · Большая пятёрка</p>
              <h1>{name}</h1>
            </div>
          </div>
          <ul className={styles.poles}>
            {typePoles(code).map(({ trait, pole }) => (
              <li key={trait}>
                <Link href={traitPath(trait, pole)}>
                  <span>{TRAIT_LABELS[trait]}</span><span className={styles.poleValue}>— {POLE_WORDS[pole]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.lead}>{texts.short}</p>
        </header>
        <PersonalityReading text={texts.long} />
        <p className={styles.note}>
          Пятая шкала — {TRAIT_LABELS.stability.toLowerCase()} — не меняет тип, а уточняет его: каждый тип бывает спокойным или чувствительным.
          Подробнее — о <Link href={traitPath("stability", "high")}>высокой</Link> и <Link href={traitPath("stability", "low")}>низкой</Link>{" "}
          устойчивости.
        </p>
        <div className={styles.cta}><TestCta title="Это ваш тип?" /></div>
        <section className={styles.section} aria-labelledby="other-types">
          <h2 id="other-types">Другие типы</h2>
          <ul className={styles.links}>
            {ALL_TYPE_CODES.filter((other) => other !== code).map((other) => (
              <li key={other}>
                <Link href={typePath(other)}>{typeDisplayName(other)}</Link>
              </li>
            ))}
          </ul>
        </section>
        <JsonLd data={webPageJsonLd({ title: page.title, description: page.description, path: typePath(code) })} />
      </article>
    </main>
  );
}
