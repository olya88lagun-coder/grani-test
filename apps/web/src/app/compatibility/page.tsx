import { COMPATIBILITY_LEVELS, formatRub, PRODUCT_PRICES, RESOURCE_TRAITS, SIMILARITY_TRAITS, TOGETHER_PERIOD_DAYS, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import { compatibilityTexts, TRAIT_LABELS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { typeCodeToDir } from "@grani/content";
import styles from "./compatibility.module.css";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PairProductsCompare } from "@/components/PairProductsCompare";
import { TestCta } from "@/components/TestCta";
import { PAIR_SECTION_PITCH, PAIR_SECTION_TITLES } from "@/lib/pair-view";
import { publicMetadata } from "@/lib/seo";

const DESCRIPTION = "Пройдите тест вдвоём и узнайте процент совместимости по Большой пятёрке. Бесплатно — типы обоих и процент, подробный разбор пары — по желанию.";

export const metadata = publicMetadata({ title: "Тест на совместимость пары", description: DESCRIPTION, path: "/compatibility" });

const labels = (traits: readonly (keyof typeof TRAIT_LABELS)[]) => traits.map((trait) => TRAIT_LABELS[trait].toLowerCase()).join(", ");

// Новому человеку — начать с теста; тому, кто уже прошёл, — сразу к блоку приглашения на своём результате
function PairActions() {
  return (
    <div className="row pair-actions">
      <Link className="button" href="/test">
        Пройти тест <span aria-hidden="true">→</span>
      </Link>
      <Link className="button button--ghost" href="/me?to=pairs">
        Уже прошли — позвать партнёра
      </Link>
    </div>
  );
}

export default function CompatibilityPage() {
  const library = getLibrary();
  const price = formatRub(PRODUCT_PRICES.pair);
  return (
    <main className={`inner-page ${styles.page}`} data-night-entry>
      <article>
        <section className={styles.hero} data-band="night">
        <div className={styles.wrap}>
        <Breadcrumbs items={[{ name: "Совместимость пары", path: "/compatibility" }]} />
        <header className={styles.intro}>
          <div className="inner-intro__copy">
            <p className="eyebrow">Для двоих</p>
            <h1 className="display">Тест на совместимость пары</h1>
            <p className="lead">{DESCRIPTION}</p>
            <PairActions />
          </div>
          <div className={styles.scene}>
            <div className={styles.stones} aria-hidden="true">
              <div><GemPortrait dir={gemAssetDir(typeCodeToDir("+-++"))} size={220} priority /><span>Ты</span></div>
              <span className={styles.connector}>+</span>
              <div><GemPortrait dir={gemAssetDir(typeCodeToDir("++--"))} size={220} priority /><span>Партнёр</span></div>
            </div>
            <p className={styles.percent}>78%<span>пример · совместимость</span></p>
          </div>
        </header>
        </div>
        </section>
        <div className={styles.content}>

        <section className="inner-block stack">
          <h2>Как это работает</h2>
          <ol className="steps">
            <li>Вы проходите тест — 50 утверждений, около 10 минут.</li>
            <li>На странице своего результата, в блоке «Посмотреть, как вы сочетаетесь», нажимаете «Позвать партнёра» и отправляете ссылку.</li>
            <li>Партнёр проходит тест и соглашается показать результат вам — без согласия пара не создаётся.</li>
            <li>Вы оба видите типы друг друга и процент совместимости, это бесплатно. Захотите разобраться глубже — откроете разбор пары: одна оплата, доступ обоим.</li>
          </ol>
          <p>Выйти из пары можно в любой момент — страница пары и разбор скроются у обоих.</p>
          <PairActions />
        </section>

        <section className="inner-block stack" aria-labelledby="pair-familiar">
          <h2 id="pair-familiar">Знакомо?</h2>
          <ul className="stack">
            <li>Один планирует на месяц вперёд, другой решает по настроению.</li>
            <li>Один хочет обсудить сразу, другому нужно время побыть с мыслями.</li>
            <li>По-разному смотрите на порядок дома и на деньги.</li>
            <li>Хочется поддержать, но не всегда понятно, как именно.</li>
          </ul>
          <p>Это не поломка, а разные характеры. Разбор пары называет эти различия словами и подсказывает, о чём договориться.</p>
        </section>

        </div>
        <section className={`${styles.report} stack`} data-band="night" aria-labelledby="pair-report-inside">
        <div className={`${styles.wrap} stack`}>
          <p className="eyebrow">Платный разбор · {price}</p>
          <h2 id="pair-report-inside">Процент — это начало. Разбор объясняет, что за ним</h2>
          <p className="lead">
            Это не общий текст для всех пар: разбор собран из результатов вас обоих — как ваши пять черт сочетаются в каждой теме. Он говорит о вас как о паре, без «кто прав»
            и «кто виноват».
          </p>
          <div className="pair-sections" role="list" aria-label="Пять разделов разбора пары">
            {(Object.keys(PAIR_SECTION_TITLES) as (keyof typeof PAIR_SECTION_TITLES)[]).map((key, index) => (
              <section key={key} role="listitem" className="card stack">
                <p className="eyebrow">Раздел {index + 1}</p>
                <h3>{PAIR_SECTION_TITLES[key]}</h3>
                <p>{PAIR_SECTION_PITCH[key]}</p>
              </section>
            ))}
          </div>
          <div className={`${styles.price} stack`} aria-labelledby="pair-price-title">
            <h3 id="pair-price-title">Что бесплатно, а что за {price}</h3>
            <ul className="stack">
              <li>
                <strong>Бесплатно:</strong> типы обоих, процент совместимости, пояснение вашего уровня и из чего сложился процент.
              </li>
              <li>
                <strong>За {price}:</strong> пять разделов разбора, развёрнутым текстом по вашим результатам.
              </li>
              <li>Одна оплата открывает разбор обоим, платит один. Это разовая покупка, без подписки.</li>
              <li>Разбор появляется примерно через минуту после оплаты, чек самозанятого приходит на указанную почту.</li>
              <li>
                Условия возврата — в <Link href="/offer">оферте</Link>.
              </li>
            </ul>
            <PairActions />
          </div>
        </div>
        </section>
        <div className={styles.content}>

        <section className="inner-block stack">
          <h2>Из чего складывается процент</h2>
          <p>Процент складывается из двух равных частей:</p>
          <ul className="formula">
            <li>
              <img className="formula__icon" src="/home/hero-crystal.webp" alt="" width={908} height={1062} />
              <strong>Ресурс пары</strong> — {labels(RESOURCE_TRAITS)} обоих. Чем они выше, тем легче договариваться и переживать трудности.
            </li>
            <li>
              <svg className="formula__icon formula__icon--venn" viewBox="0 0 64 40" aria-hidden="true">
                <circle cx="24" cy="20" r="16" />
                <circle cx="40" cy="20" r="16" />
              </svg>
              <strong>Похожесть</strong> — насколько близки ваши {labels(SIMILARITY_TRAITS)}. В этих чертах похожие люди обычно понимают
              друг друга без объяснений.
            </li>
          </ul>
        </section>

        <section className="inner-block stack">
          <h2>Пять уровней совместимости</h2>
          <div className="level-grid">
            {COMPATIBILITY_LEVELS.map(({ min, level }) => {
              const texts = compatibilityTexts(library, level);
              return (
                <section key={level} className={`card stack level-card level-card--${level}`}>
                  <p className="level-card__percent">от {min}%</p>
                  <h3>{texts.phrase}</h3>
                  <p>{texts.text}</p>
                </section>
              );
            })}
          </div>
        </section>

        <PairProductsCompare
          headingId="pair-products"
          current="compatibility"
          prices={{ compatibility: price, together: `${formatRub(TOGETHER_PRICE_KOPECKS)} за ${TOGETHER_PERIOD_DAYS} дней` }}
        />

        <p className="muted">Процент — повод поговорить о том, как вы устроены, а не приговор отношениям.</p>
        <TestCta title="Начните с себя" />
        </div>
      </article>
    </main>
  );
}
