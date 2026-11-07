import { getShortTest } from "@grani/content/short-tests";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ShortTestRunner } from "@/components/short-tests/ShortTestRunner";
import { faqJsonLd, publicMetadata, webPageJsonLd } from "@/lib/seo";
import styles from "./privyazannost.module.css";

const TEST = getShortTest("attachment")!;

export const metadata = publicMetadata({ title: TEST.title, description: TEST.description, path: TEST.path });

export default function AttachmentTestPage() {
  return (
    <main className={styles.landing} data-palette="pair" data-night-entry>
      <JsonLd data={webPageJsonLd({ title: TEST.title, description: TEST.description, path: TEST.path })} />
      <JsonLd data={faqJsonLd(TEST.faq)} />
      <header className={styles.hero} data-band="night">
        <div className={styles.heroWrap}>
          <Breadcrumbs items={[{ name: TEST.h1, path: TEST.path }]} />
          <div className={styles.heroGrid}>
            <picture className={styles.heroArt} aria-hidden="true">
              <source media="(max-width: 680px)" srcSet="/attachment/hero-mobile.webp" />
              <img src="/attachment/hero-desktop.webp" alt="" width={1600} height={800} fetchPriority="high" />
            </picture>
            <div className={styles.heroCopy}>
              <h1 className={styles.title}>{TEST.h1}</h1>
              <p className={styles.heroLead}>
                Посмотрите, как вы реагируете на близость и дистанцию в отношениях.
                В результате вы увидите свою точку на карте четырёх типов.
              </p>
              <a className={`button ${styles.heroAction}`} href="#attachment-test">
                Пройти тест <span aria-hidden="true">→</span>
              </a>
              <p className={styles.facts}>30 утверждений · около 5 минут · бесплатно · без регистрации</p>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.test} id="attachment-test" tabIndex={-1}>
          <ShortTestRunner slug={TEST.slug} />
        </div>
        <article className={styles.reading}>
          <section className={styles.brief}>
            <h2>Кратко</h2>
            <p>{TEST.brief}</p>
          </section>

          {TEST.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.text}</p>
            </section>
          ))}

          <section>
            <h2>Четыре типа подробно</h2>
            <ul className={styles.types}>
              {TEST.types.map((type) => (
                <li key={type.key}>
                  <Link href={`${TEST.path}/${type.slug}`}>{type.name}</Link>
                  <span>{type.tagline}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Вопросы и ответы</h2>
            {TEST.faq.map((item) => (
              <details key={item.question} className={styles.faq}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>

          <section>
            <h2>Источники</h2>
            <ol className={styles.sources}>
              {TEST.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ol>
          </section>

          <p className={styles.disclaimer}>{TEST.disclaimer}</p>

          <section className={styles.next}>
            <h2>Что ещё пройти</h2>
            <p>
              <Link href="/big-five-test">Тест Big Five</Link> покажет пять черт личности и объяснит, откуда берутся ваши реакции. А{" "}
              <Link href="/compatibility">тест на совместимость пары</Link> сравнит вас с партнёром по тем же чертам.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
