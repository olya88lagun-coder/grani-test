import { ALL_TYPE_CODES, TYPE_TRAITS } from "@grani/core";
import { TRAIT_LABELS, typeCodeToDir, typeTexts } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TestCta } from "@/components/TestCta";
import { TypeGem } from "@/components/TypeGem";
import { firstSentences, publicMetadata, traitPath, typePath } from "@/lib/seo";
import { typeDisplayName } from "@/lib/seo-pages";
import { TYPE_VISUALS, type TypeFamily } from "@/lib/type-visuals";
import styles from "../personality.module.css";

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

export default function TypesPage() {
  const library = getLibrary();
  return (
    <main className={styles.page}>
      <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }]} />
      <header className={styles.intro}>
        <div className={styles.introCopy}>
          <p className="eyebrow">Большая пятёрка</p>
          <h1>16 типов личности</h1>
          <p className={styles.lead}>
            Тип складывается из четырёх черт:{" "}
            {TYPE_TRAITS.map((trait, index) => (
              <span key={trait}>
                {index > 0 && ", "}
                <Link href={traitPath(trait, "high")}>{TRAIT_LABELS[trait].toLowerCase()}</Link>
              </span>
            ))}
            . Каждая бывает высокой или низкой — отсюда 16 сочетаний. Пятая черта,{" "}
            <Link href={traitPath("stability", "high")}>эмоциональная устойчивость</Link>, уточняет тип: спокойный он или чувствительный.
          </p>
        </div>
        <img className={styles.crystal} src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
      </header>
      <nav className={styles.familyNav} aria-label="Семейства типов">
        {FAMILIES.map(({ family, title }) => <a key={family} href={`#family-${family}`}>{title}</a>)}
      </nav>
      {FAMILIES.map(({ family, title }) => (
        <section key={family} className={styles.family} aria-labelledby={`family-${family}`}>
          <h2 id={`family-${family}`}>{title}</h2>
          <ul className={styles.typeGrid}>
            {ALL_TYPE_CODES.filter((code) => TYPE_VISUALS[typeCodeToDir(code)]?.family === family).map((code) => {
              const visual = TYPE_VISUALS[typeCodeToDir(code)]!;
              return (
                <li key={code}>
                  <Link className={styles.typeCard} href={typePath(code)}>
                    <span className={styles.symbol} data-family={visual.family}>
                      <TypeGem shape={visual.shape} size={56} />
                    </span>
                    <h3>{typeDisplayName(code)}</h3>
                    <p>{firstSentences(typeTexts(library, code).short, 140)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className={styles.cta}><TestCta /></div>
    </main>
  );
}
