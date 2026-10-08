import { TRAITS } from "@grani/core";
import { PAGE_POLES, TRAIT_LABELS, traitPageIntro } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TestCta } from "@/components/TestCta";
import { firstSentences, publicMetadata, traitPath, webPageJsonLd } from "@/lib/seo";
import { traitPageTitle } from "@/lib/seo-pages";
import styles from "./traits.module.css";

const TITLE = "Черты личности по Большой пятёрке";
const DESCRIPTION =
  "Пять черт «Большой пятёрки»: открытость опыту, добросовестность, экстраверсия, доброжелательность и эмоциональная устойчивость. Что значит высокий и низкий уровень каждой.";

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: "/traits" });

// Раздел для страниц черт: без него хлебные крошки вели в «Типы», к которым черта не относится
export default function TraitsPage() {
  const library = getLibrary();
  return (
    <main className={styles.main} data-night-entry>
      <article>
        <section className={styles.hero} data-band="night">
          <div className={styles.wrap}>
            <Breadcrumbs items={[{ name: "Черты личности", path: "/traits" }]} />
            <header className={styles.intro}>
              <p className={styles.eyebrow}>Большая пятёрка</p>
              <h1>Черты личности</h1>
              <p className={styles.lead}>
                Модель описывает характер пятью шкалами. У каждой два полюса, и большинство людей где-то между ними. Подробнее о модели — в статье{" "}
                <Link href="/articles/big-five">«Большая пятёрка»</Link>, о том, как черты складываются в тип, — на странице{" "}
                <Link href="/types">16 типов</Link>.
              </p>
            </header>
          </div>
        </section>
        <section className={styles.list} data-band="night" aria-label="Пять черт">
          <div className={styles.wrap}>
            {TRAITS.map((trait, index) => (
              <section key={trait} className={styles.row} aria-labelledby={`trait-${trait}`}>
                <span className={styles.num} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h2 id={`trait-${trait}`}>{TRAIT_LABELS[trait]}</h2>
                <div>
                  <p>{firstSentences(traitPageIntro(library, trait, "high"), 160)}</p>
                  <ul className={styles.ends}>
                    {PAGE_POLES.map((pole) => (
                      <li key={pole}>
                        <Link href={traitPath(trait, pole)}>{traitPageTitle(trait, pole)}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        </section>
        <section className={styles.closing} data-band="night" aria-label="Продолжение">
          <div className={styles.wrap}><TestCta title="Узнай свой профиль" /></div>
        </section>
        <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: "/traits" })} />
      </article>
    </main>
  );
}
