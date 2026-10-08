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
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { firstSentences, publicMetadata, traitPath, TYPE_SLUGS, typeBySlug, typePath, webPageJsonLd } from "@/lib/seo";
import { POLE_WORDS, typeDisplayName, typePoles } from "@/lib/seo-pages";
import { TYPE_VISUALS } from "@/lib/type-visuals";
import styles from "../../personality.module.css";
import detail from "./type-detail.module.css";

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
    <main className={detail.main} data-night-entry>
      <article>
        <section className={detail.hero} data-band="night" data-family={visual.family}>
          <div className={detail.wrap}>
            <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }, { name, path: typePath(code) }]} />
            <header className={detail.grid}>
              <div className={detail.copy}>
                <p className={detail.eyebrow}>Тип личности · Большая пятёрка</p>
                <h1>{name}</h1>
                <p className={detail.lead}>{texts.short}</p>
                <ul className={detail.poles} aria-label="Шкалы типа">
                  {typePoles(code).map(({ trait, pole }) => (
                    <li key={trait}>
                      <Link href={traitPath(trait, pole)}>
                        <span>{TRAIT_LABELS[trait]}</span><span className={detail.poleValue}>{POLE_WORDS[pole]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={detail.gem} aria-hidden="true">
                <GemPortrait dir={gemAssetDir(typeCodeToDir(code))} size={360} priority />
              </div>
            </header>
          </div>
        </section>
        <div className={detail.body}>
          <div className={`${styles.page} ${styles.detail}`}>
            <PersonalityReading text={texts.long} />
            <p className={styles.note}>
              Пятая шкала — {TRAIT_LABELS.stability.toLowerCase()} — не меняет тип, а уточняет его: каждый тип бывает спокойным или чувствительным.
              Подробнее — о <Link href={traitPath("stability", "high")}>высокой</Link> и <Link href={traitPath("stability", "low")}>низкой</Link>{" "}
              устойчивости.
            </p>
          </div>
        </div>
        <section className={detail.closing} data-band="night" aria-label="Продолжение">
          <div className={detail.wrap}>
            <TestCta title="Это ваш тип?" />
            <div className={detail.others}>
              <h2 id="other-types">Другие типы</h2>
              <ul className={detail.links} aria-labelledby="other-types">
                {ALL_TYPE_CODES.filter((other) => other !== code).map((other) => (
                  <li key={other}>
                    <Link href={typePath(other)}>{typeDisplayName(other)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <JsonLd data={webPageJsonLd({ title: page.title, description: page.description, path: typePath(code) })} />
      </article>
    </main>
  );
}
