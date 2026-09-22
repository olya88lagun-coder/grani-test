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
    <main className="page page--wide">
      <div className="stack">
        <Breadcrumbs items={[{ name: "Типы личности", path: "/types" }]} />
        <p className="eyebrow">Большая пятёрка</p>
        <h1 className="display">16 типов личности</h1>
        <p className="lead">
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
        {FAMILIES.map(({ family, title }) => (
          <section key={family} className="stack" aria-labelledby={`family-${family}`}>
            <h2 id={`family-${family}`}>{title}</h2>
            <ul className="type-grid">
              {ALL_TYPE_CODES.filter((code) => TYPE_VISUALS[typeCodeToDir(code)]?.family === family).map((code) => {
                const visual = TYPE_VISUALS[typeCodeToDir(code)]!;
                return (
                  <li key={code} className="card card--paper type-tile">
                    <span className="type-gem" data-family={visual.family}>
                      <TypeGem shape={visual.shape} size={44} />
                    </span>
                    <div className="stack">
                      <h3>
                        <Link href={typePath(code)}>{typeDisplayName(code)}</Link>
                      </h3>
                      <p className="muted">{firstSentences(typeTexts(library, code).short, 140)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <TestCta />
      </div>
    </main>
  );
}
