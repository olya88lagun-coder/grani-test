import { TRAITS } from "@grani/core";
import { PAGE_POLES, TRAIT_LABELS, traitPageIntro } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TestCta } from "@/components/TestCta";
import { firstSentences, publicMetadata, traitPath, webPageJsonLd } from "@/lib/seo";
import { traitPageTitle } from "@/lib/seo-pages";

const TITLE = "Черты личности по Большой пятёрке";
const DESCRIPTION =
  "Пять черт «Большой пятёрки»: открытость опыту, добросовестность, экстраверсия, доброжелательность и эмоциональная устойчивость. Что значит высокий и низкий уровень каждой.";

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: "/traits" });

// Раздел для страниц черт: без него хлебные крошки вели в «Типы», к которым черта не относится
export default function TraitsPage() {
  const library = getLibrary();
  return (
    <main className="page inner-text">
      <article className="stack">
        <Breadcrumbs items={[{ name: "Черты личности", path: "/traits" }]} />
        <p className="eyebrow">Большая пятёрка</p>
        <h1 className="display">Черты личности</h1>
        <p className="lead">
          Модель описывает характер пятью шкалами. У каждой два полюса, и большинство людей где-то между ними. Подробнее о модели — в статье{" "}
          <Link href="/articles/big-five">«Большая пятёрка»</Link>, о том, как черты складываются в тип, — на странице{" "}
          <Link href="/types">16 типов</Link>.
        </p>
        {TRAITS.map((trait) => (
          <section key={trait} className="stack" aria-labelledby={`trait-${trait}`}>
            <h2 id={`trait-${trait}`}>{TRAIT_LABELS[trait]}</h2>
            <p className="muted">{firstSentences(traitPageIntro(library, trait, "high"), 160)}</p>
            <ul className="link-grid">
              {PAGE_POLES.map((pole) => (
                <li key={pole}>
                  <Link href={traitPath(trait, pole)}>{traitPageTitle(trait, pole)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <TestCta title="Узнай свой профиль" />
        <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: "/traits" })} />
      </article>
    </main>
  );
}
