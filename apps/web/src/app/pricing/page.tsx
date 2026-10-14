import { CHAPTER_TITLES } from "@grani/content";
import { CHAPTER_KINDS, formatRub, PRODUCT_PRICES, TOGETHER_PERIOD_DAYS, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import Link from "next/link";
import Image from "next/image";
import styles from "./pricing.module.css";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PairProductsCompare } from "@/components/PairProductsCompare";
import { publicMetadata } from "@/lib/seo";

const DESCRIPTION = "Тест, тип и пять шкал — бесплатно. Платно — подробные разборы по результату: личный портрет, главы о деньгах, конфликтах, стрессе и отношениях, разбор пары, пространство «Вдвоём».";

export const metadata = publicMetadata({ title: "Разборы и цены", description: DESCRIPTION, path: "/pricing" });

const FULL_SECTIONS = [
  "Портрет: как сочетаются твои черты",
  "Сильные стороны",
  "Слепые зоны и что с ними делать",
  "Инструкция по применению меня: как с тобой работать, спорить и что тебя бесит",
] as const;

const PAIR_FEATURES = [
  "Обзор пары и пять шкал обоих партнёров",
  "8 жизненных ситуаций и переключение взгляда: о себе или о партнёре",
  "«Переводчик друг друга» и четыре шага сложного разговора",
  "8 вопросов обоим: ответы раскрываются после публикации каждым",
  "3 договорённости: личные черновики, общие предложения и подтверждение одной версии обоими",
  "Персональная карта в PDF; раскрытые ответы можно включить по желанию",
] as const;

export default function PricingPage() {
  const chapterPrice = PRODUCT_PRICES.chapter_money;
  const chaptersSeparately = chapterPrice * CHAPTER_KINDS.length;
  return (
    <main className={`inner-page ${styles.page}`} data-night-entry data-band="night">
      <section className={styles.hero}>
        <div className={styles.wrap}>
          <Breadcrumbs items={[{ name: "Разборы и цены", path: "/pricing" }]} />
          <header className={styles.intro}>
            <p className={styles.eyebrow}>Платные разборы</p>
            <h1>Разборы и цены</h1>
            <p className={styles.lead}>{DESCRIPTION}</p>
          </header>
          <nav className={styles.productNav} aria-label="Выбрать разбор">
            <a href="#price-full"><span>Для себя</span><strong>{formatRub(PRODUCT_PRICES.full)}</strong></a>
            <a href="#price-pair"><span>Карта пары</span><strong>{formatRub(PRODUCT_PRICES.pair)}</strong></a>
            <a href="#price-together"><span>Вдвоём</span><strong>{formatRub(TOGETHER_PRICE_KOPECKS)} / {TOGETHER_PERIOD_DAYS} дней</strong></a>
            <a href="#price-chapters"><span>Дополнительные главы</span><strong>{formatRub(chapterPrice)} за главу</strong></a>
          </nav>
        </div>
      </section>
      <article className="page page--wide stack pricing-page">

        <div className={styles.featured}>
          <section className="card stack pricing-card pricing-card--featured" data-band="night" aria-labelledby="price-full">
            <p className="eyebrow">Главное</p>
            <h2 id="price-full">Полный разбор личности</h2>
            <p className="pricing-card__price">{formatRub(PRODUCT_PRICES.full)}</p>
            <div className="pricing-card__cta">
              <Link className="button" href="/test">
                Пройти тест <span aria-hidden="true">→</span>
              </Link>
              <p className="muted">Купить можно на странице своего результата.</p>
            </div>
            <ul className="pricing-card__list">
              {FULL_SECTIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className={`muted ${styles.included}`}>
              <strong>Без доплаты:</strong> раздел «Как меня видят другие» — он появляется, когда на вопросы о вас ответят трое друзей, и в цену разбора не входит.
            </p>

          </section>

          <figure className={styles.example}>
            <figcaption>Пример</figcaption>
            <div className={styles.examplePages}>
              <a className={styles.portraitExample} href="/pricing/portrait-example-v1.webp" target="_blank" rel="noopener noreferrer">
                <Image src="/pricing/portrait-example-v1.webp" alt="Портрет" width={1124} height={1328} sizes="(max-width: 759px) calc(100vw - 74px), (max-width: 1099px) 43vw, 440px" />
              </a>
              <a className={styles.lifeExample} href="/pricing/life-example-v1.webp" target="_blank" rel="noopener noreferrer">
                <Image src="/pricing/life-example-v1.webp" alt="В жизни" width={554} height={672} sizes="(max-width: 759px) calc(100vw - 74px), (max-width: 1099px) 43vw, 280px" />
              </a>
            </div>
          </figure>
        </div>

        <div className={`pricing-grid ${styles.grid}`}>

          <section className="card stack pricing-card pricing-card--pair" data-band="night" aria-labelledby="price-pair">
            <p className="eyebrow">Для двоих</p>
            <h2 id="price-pair">Разбор совместимости пары</h2>
            <p className="pricing-card__price">{formatRub(PRODUCT_PRICES.pair)}</p>
            <div className="pricing-card__cta">
              <Link className="button button--ghost" href="/compatibility">
                Как это работает <span aria-hidden="true">→</span>
              </Link>
              <p className="muted">Открывается обоим, платит один. Партнёр проходит тест по вашей ссылке.</p>
            </div>
            <ul className="pricing-card__list">
              {PAIR_FEATURES.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
            <p className={`muted ${styles.included}`}><strong>Разовая покупка без подписки.</strong> Совместная анкета и общие договорённости — по отдельному согласию обоих; базовый PDF доступен без них.</p>
          </section>

          <section className="card stack pricing-card pricing-card--pair" data-band="night" aria-labelledby="price-together">
            <p className="eyebrow">Для двоих</p>
            <h2 id="price-together">Грани. Вдвоём</h2>
            <p className="pricing-card__price">{formatRub(TOGETHER_PRICE_KOPECKS)}</p>
            <div className="pricing-card__cta">
              <Link className="button button--ghost" href="/together">
                Что внутри <span aria-hidden="true">→</span>
              </Link>
              <p className="muted">Три вводные карточки бесплатно. Открывается обоим, платит один.</p>
            </div>
            <ul className="pricing-card__list">
              <li>Пространство для двоих на {TOGETHER_PERIOD_DAYS} дней, без автопродления</li>
              <li>Вопросы для разговора и идеи свиданий: каждый отвечает сам, ответы открываются, когда ответили оба</li>
              <li>Тест личности не нужен</li>
            </ul>

          </section>

          <section className="card stack pricing-card" data-band="night" aria-labelledby="price-chapters">
            <p className="eyebrow">Дополнение к полному разбору</p>
            <h2 id="price-chapters">Главы</h2>
            <p className="pricing-card__price">{formatRub(chapterPrice)} <span className={styles.priceUnit}>за главу</span></p>
            <ul className="pricing-card__list">
              {CHAPTER_KINDS.map((kind) => (
                <li key={kind}>{CHAPTER_TITLES[kind]}</li>
              ))}
            </ul>
            <p className="pricing-card__bundle">
              Все четыре — {formatRub(PRODUCT_PRICES.chapters_all)} вместо {formatRub(chaptersSeparately)}
            </p>
            <p className="muted">Открываются после покупки полного разбора, на его странице.</p>
          </section>
        </div>

        <div className={styles.trust}>
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></svg>
          <p className="muted pricing-page__terms">
          Оплата картой через ЮKassa, чек самозанятого из «Мой налог» оформляется после оплаты. Разбор появляется на сайте через пару минут после оплаты. Условия и возвраты — в{" "}
          <Link href="/offer">оферте</Link>.
        </p>
        </div>

        <PairProductsCompare headingId="pair-products" prices={{ compatibility: formatRub(PRODUCT_PRICES.pair), together: `${formatRub(TOGETHER_PRICE_KOPECKS)} за ${TOGETHER_PERIOD_DAYS} дней` }} />
      </article>
    </main>
  );
}
