import { COMPATIBILITY_LEVELS, formatRub, PRODUCT_PRICES, RESOURCE_TRAITS, SIMILARITY_TRAITS, TOGETHER_PERIOD_DAYS, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import { compatibilityTexts, TRAIT_LABELS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import Link from "next/link";
import styles from "./compatibility.module.css";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PairProductsCompare } from "@/components/PairProductsCompare";
import { TestCta } from "@/components/TestCta";
import { PAIR_GUIDE_CONTENTS } from "@/lib/pair-guide";
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
        <div className={styles.art} aria-hidden="true">
          <picture>
            <source media="(max-width: 759px)" srcSet="/compatibility/hero-night-mobile.webp" />
            <img src="/compatibility/hero-night-desktop.webp" alt="" width={2400} height={1200} fetchPriority="high" />
          </picture>
        </div>
        <div className={styles.wrap}>
        <Breadcrumbs items={[{ name: "Совместимость пары", path: "/compatibility" }]} />
        <header className={styles.intro}>
          <div className="inner-intro__copy">
            <p className="eyebrow">Для двоих</p>
            <h1 className="display">Тест на совместимость пары</h1>
            <p className="lead">{DESCRIPTION}</p>
            <PairActions />
          </div>
          <p className={styles.percent}>78%<span>пример · совместимость пары</span></p>
        </header>
        </div>
        </section>
        <div className={styles.content}>

        <section className={styles.how} aria-labelledby="pair-how">
          <h2 id="pair-how">Как это работает</h2>
          <ol className={styles.steps}>
            <li><span aria-hidden="true">01</span><h3>Пройдите тест</h3><p>50 утверждений, около 10 минут.</p></li>
            <li><span aria-hidden="true">02</span><h3>Позовите партнёра</h3><p>Отправьте ссылку из блока «Посмотреть, как вы сочетаетесь» на странице результата.</p></li>
            <li><span aria-hidden="true">03</span><h3>Увидьте процент</h3><p>Партнёр проходит тест и соглашается показать результат. Типы обоих и процент — бесплатно.</p></li>
          </ol>
          <p className={styles.note}>Без согласия партнёра пара не создаётся. Выйти можно в любой момент: страница пары и разбор скроются у обоих.</p>
        </section>

        </div>
        <section className={`${styles.report} stack`} data-band="night" aria-labelledby="pair-report-inside">
        <div className={styles.wrap}>
          <p className="eyebrow">Разбор пары</p>
          <h2 id="pair-report-inside">Карта вашей пары — инструкция друг к другу</h2>
          <p className={styles.hook}>Один планирует на месяц вперёд, другой решает по настроению. Это не поломка, а разные характеры. Разбор называет различия словами и подсказывает, о чём договориться.</p>
          <div className={styles.offer}>
            <div className={styles.panel}>
              <h3>Бесплатно</h3>
              <ul className={styles.checks}>
                <li>Типы обоих</li>
                <li>Процент совместимости</li>
                <li>Из чего сложился процент</li>
              </ul>
            </div>
            <div className={`${styles.panel} ${styles.panelPaid}`}>
              <div className={styles.paidHead}><h3>Разбор пары</h3><p className={styles.priceTag}>{price}</p></div>
              <ol className={styles.sections} aria-label="Разделы интерактивной карты пары">
                {PAIR_GUIDE_CONTENTS.map((item, index) => (
                  <li key={item.id}><span aria-hidden="true">{index + 1}</span><div><h4>{item.title}</h4><p>{[
                    "Близкие черты и различия, с которых можно начать разговор.",
                    "Пять настоящих шкал обоих партнёров. Профили доступны и бесплатно.",
                    "Быт, деньги, отдых, близость и поддержка. Переключайте перспективу и проверяйте гипотезы друг с другом.",
                    "Возможная потребность и пример бережной формулировки для выбранной ситуации.",
                    "Четыре шага: выбрать время, назвать факт, услышать друг друга и договориться о маленьком действии.",
                    "Редактируемые заготовки, которые можно сохранить как личные черновики в текущей вкладке.",
                    "Один небольшой шаг для вашей пары и дополнительный текстовый разбор в пяти разделах.",
                  ][index]}</p></div></li>
                ))}
              </ol>
            </div>
          </div>
          <PairActions />
          <p className={styles.facts}>Одна оплата открывает разбор обоим, платит один. Разовая покупка без подписки. Интерактивная карта доступна после подтверждения оплаты; дополнительный текст готовится отдельно. Чек самозанятого приходит на почту. Условия возврата — в <Link href="/offer">оферте</Link>.</p>
          <p className={styles.facts}>PDF, общий опрос и совместное подтверждение договорённостей пока недоступны. Подсказки по Big Five — гипотезы для обсуждения, а не прогноз успеха пары.</p>
        </div>
        </section>
        <div className={styles.content}>

        <section className={styles.more} aria-label="Как считается совместимость">
          <details>
            <summary>Из чего складывается процент</summary>
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
          </details>
          <details>
            <summary>Пять уровней совместимости</summary>
            <ol className={styles.levels}>
              {COMPATIBILITY_LEVELS.map(({ min, level }) => {
                const texts = compatibilityTexts(library, level);
                return (
                  <li key={level}>
                    <p className={styles.levelPercent}>от {min}%</p>
                    <div><h4>{texts.phrase}</h4><p>{texts.text}</p></div>
                  </li>
                );
              })}
            </ol>
          </details>
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
