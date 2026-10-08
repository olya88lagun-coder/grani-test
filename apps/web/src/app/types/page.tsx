import { ALL_TYPE_CODES, TYPE_TRAITS } from "@grani/core";
import { TRAIT_LABELS, typeCodeToDir, typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { firstSentences, publicMetadata, traitPath, typePath } from "@/lib/seo";
import { typeDisplayName } from "@/lib/seo-pages";
import { TYPE_VISUALS, type TypeFamily } from "@/lib/type-visuals";
import styles from "../personality.module.css";
import index from "./types-index.module.css";

export const metadata = publicMetadata({
  title: "16 типов личности по Большой пятёрке",
  description: "Описания всех 16 типов личности «Граней»: из каких черт складывается каждый тип, сильные стороны и слабые места. Пройдите бесплатный тест и узнайте свой.",
  path: "/types",
});

// Семья — первые две буквы кода: открытость и добросовестность
const FAMILIES: readonly { family: TypeFamily; title: string }[] = [
  { family: 1, title: "Открытые и собранные" },
  { family: 2, title: "Открытые и свободные" },
  { family: 3, title: "Практичные и собранные" },
  { family: 4, title: "Практичные и свободные" },
];

// Камень для значка семьи: по одному типу из каждой
const FAMILY_ICON = { 1: "pppp", 2: "pmpp", 3: "mppp", 4: "mmpp" } as const;

export default function TypesPage() {
  const library = getLibrary();
  return (
    <main className={`${styles.page} ${index.main}`} data-night-entry>
      <section className={index.hero} data-band="night">
        <div className={index.wrap}>
          <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }]} />
          <header className={index.intro}>
            <div className={styles.introCopy}>
              <p className="eyebrow">Большая пятёрка</p>
              <h1>16 типов личности</h1>
              <p className={styles.lead}>
                Тип складывается из четырёх черт:{" "}
                {TYPE_TRAITS.map((trait, position) => (
                  <span key={trait}>
                    {position > 0 && ", "}
                    <Link href={traitPath(trait, "high")}>{TRAIT_LABELS[trait].toLowerCase()}</Link>
                  </span>
                ))}
                . Каждая бывает высокой или низкой — отсюда 16 сочетаний. Пятая черта,{" "}
                <Link href={traitPath("stability", "high")}>эмоциональная устойчивость</Link>, уточняет тип: спокойный он или чувствительный.
              </p>
            </div>
          </header>
          <nav className={index.familyNav} aria-label="Семейства типов">
            {FAMILIES.map(({ family, title }) => (
              <a key={family} href={`#family-${family}`}>
                <GemPortrait dir={FAMILY_ICON[family]} size={34} />
                {title}
              </a>
            ))}
          </nav>
        </div>
      </section>
      {FAMILIES.map(({ family, title }) => (
        <section key={family} className={index.family} data-band={family % 2 === 0 ? "night" : undefined} aria-labelledby={`family-${family}`}>
          <div className={index.wrap}>
            <h2 id={`family-${family}`}>{title}</h2>
            <ul className={index.grid}>
              {ALL_TYPE_CODES.filter((code) => TYPE_VISUALS[typeCodeToDir(code)]?.family === family).map((code) => {
                const [name, feminine] = typeDisplayName(code).split(" / ");
                return (
                  <li key={code}>
                    <Link className={index.card} data-band="night" href={typePath(code)}>
                      <GemPortrait dir={gemAssetDir(typeCodeToDir(code))} size={200} />
                      <h3>{name}</h3>
                      <span className={index.feminine}>{feminine}</span>
                      <p>{firstSentences(typeTexts(library, code).short, 140)}</p>
                      <span className={index.more}>О типе <span aria-hidden="true">→</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
      <div className={index.closing}>
        <div className={index.wrap}>
          <div className={styles.cta}><TestCta /></div>
        </div>
      </div>
    </main>
  );
}
