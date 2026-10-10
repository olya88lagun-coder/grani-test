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

const TITLE = "Пять черт личности Big Five — значения шкал";
const DESCRIPTION =
  "Как устроены пять черт личности Big Five: понятные примеры открытости, добросовестности, экстраверсии, доброжелательности и эмоциональной устойчивости. Высокие и низкие значения.";

export const metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: "/traits" });

// Конкретные жизненные примеры помогают сравнить шкалы, а не просто перейти по ссылке.
// Это иллюстрации возможного поведения, а не однозначные предсказания по баллам теста.
const EVERYDAY_EXAMPLES: Record<(typeof TRAITS)[number], string> = {
  openness: "Например, один человек охотно пробует непривычный маршрут, другой предпочитает знакомый и проверенный. Оба подхода могут быть полезны в разных обстоятельствах.",
  conscientiousness: "Например, кому-то проще работать по списку и закончить дело заранее, а кому-то — реагировать на изменения по ходу. Важно замечать, что помогает выполнять реальные обязательства.",
  extraversion: "Например, после насыщенного дня один захочет снова встретиться с друзьями, другой — провести вечер в тишине. Это не измерение дружелюбия или любви к людям.",
  agreeableness: "Например, в споре один старается смягчить формулировки, другой быстрее обозначает несогласие. Важно не только мнение, но и способ договариваться.",
  stability: "Например, перед сложным разговором один остаётся довольно спокойным, другой долго прокручивает возможные варианты. Разные реакции не делают человека лучше или хуже.",
};

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
              <h1>Пять черт личности: шкалы Big Five</h1>
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
                  <p className={styles.example}>{EVERYDAY_EXAMPLES[trait]}</p>
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
        <section className={styles.howTo} data-band="night" aria-labelledby="traits-how-to">
          <div className={styles.wrap}>
            <h2 id="traits-how-to">Как читать свой профиль из пяти шкал</h2>
            <p>Big Five не распределяет людей на «хорошие» и «плохие» типы. Каждый показатель описывает тенденцию поведения, а не правило на все случаи жизни. Высокий балл не всегда преимущество, низкий — не обязательно недостаток.</p>
            <ol>
              <li><strong>Посмотри на все пять шкал.</strong> Одна яркая черта не объясняет всю личность: люди с одинаковой экстраверсией могут сильно отличаться по добросовестности и открытости.</li>
              <li><strong>Проверь примеры из своей жизни.</strong> Вспомни, как ты действуешь в привычных ситуациях — на работе, дома, с друзьями. Не делай вывод по одному удачному или неудачному дню.</li>
              <li><strong>Не преувеличивай маленькую разницу.</strong> Результат рядом с серединой шкалы не означает однозначно «высокий» или «низкий» уровень; при повторном прохождении баллы могут немного меняться.</li>
            </ol>
            <p>Если хочешь узнать свои значения, начни с <Link href="/big-five-test">бесплатного теста Big Five</Link>. Затем открой <Link href="/articles/rezultaty-big-five">руководство по чтению результата</Link> и выбери одну черту, которую интересно наблюдать в повседневности.</p>
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
