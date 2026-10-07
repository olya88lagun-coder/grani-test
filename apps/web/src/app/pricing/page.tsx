import { CHAPTER_TITLES } from "@grani/content";
import { CHAPTER_KINDS, formatRub, PRODUCT_PRICES } from "@grani/core";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PAIR_SECTION_TITLES } from "@/lib/pair-view";
import { publicMetadata } from "@/lib/seo";

const DESCRIPTION = "Тест, тип и пять шкал — бесплатно. Платно — подробные разборы по результату: личный портрет, главы о деньгах, конфликтах, стрессе и отношениях, разбор пары.";

export const metadata = publicMetadata({ title: "Разборы и цены", description: DESCRIPTION, path: "/pricing" });

const FULL_SECTIONS = [
  "Портрет: как сочетаются твои черты",
  "Сильные стороны",
  "Слепые зоны и что с ними делать",
  "Инструкция по применению меня: как с тобой работать, спорить и что тебя бесит",
] as const;

export default function PricingPage() {
  const chapterPrice = PRODUCT_PRICES.chapter_money;
  const chaptersSeparately = chapterPrice * CHAPTER_KINDS.length;
  return (
    <main className="inner-page">
      <article className="page page--wide stack pricing-page">
        <Breadcrumbs items={[{ name: "Разборы и цены", path: "/pricing" }]} />
        <header className="inner-intro__copy">
          <p className="eyebrow">Платные разборы</p>
          <h1 className="display">Разборы и цены</h1>
          <p className="lead">{DESCRIPTION}</p>
        </header>

        <div className="pricing-grid">
          <section className="card stack pricing-card pricing-card--featured" aria-labelledby="price-full">
            <p className="eyebrow">Главное</p>
            <h2 id="price-full">Полный разбор личности</h2>
            <p className="pricing-card__price">{formatRub(PRODUCT_PRICES.full)}</p>
            <ul className="pricing-card__list">
              {FULL_SECTIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="muted">
              Без доплаты: раздел «Как меня видят другие» — он появляется, когда на вопросы о вас ответят трое друзей, и в цену разбора не входит.
            </p>
            <div className="pricing-card__cta">
              <Link className="button" href="/test">
                Пройти тест <span aria-hidden="true">→</span>
              </Link>
              <p className="muted">Купить можно на странице своего результата.</p>
            </div>
          </section>

          <section className="card stack pricing-card pricing-card--pair" aria-labelledby="price-pair">
            <p className="eyebrow">Для двоих</p>
            <h2 id="price-pair">Разбор совместимости пары</h2>
            <p className="pricing-card__price">{formatRub(PRODUCT_PRICES.pair)}</p>
            <ul className="pricing-card__list">
              {Object.values(PAIR_SECTION_TITLES).map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
            <div className="pricing-card__cta">
              <Link className="button button--ghost" href="/compatibility">
                Как это работает <span aria-hidden="true">→</span>
              </Link>
              <p className="muted">Открывается обоим, платит один. Партнёр проходит тест по вашей ссылке.</p>
            </div>
          </section>

          <section className="card stack pricing-card" aria-labelledby="price-chapters">
            <p className="eyebrow">Дополнение к полному разбору</p>
            <h2 id="price-chapters">Главы</h2>
            <p className="pricing-card__price">{formatRub(chapterPrice)} за главу</p>
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

        <p className="muted pricing-page__terms">
          Оплата картой через ЮKassa, чек самозанятого из «Мой налог» оформляется после оплаты. Разбор появляется на сайте через пару минут после оплаты. Условия и возвраты — в{" "}
          <Link href="/offer">оферте</Link>.
        </p>
      </article>
    </main>
  );
}
