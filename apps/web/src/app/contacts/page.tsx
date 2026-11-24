import { formatRub, PRODUCT_PRICES, TOGETHER_PERIOD_DAYS, TOGETHER_PRICE_KOPECKS, type Product } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { NightHero } from "@/components/NightHero";
import { OPERATOR } from "@/lib/legal";
import { publicMetadata } from "@/lib/seo";
import { VK_COMMUNITY_LINK } from "@/lib/site-links";
import { PRODUCT_DESCRIPTIONS } from "@/server/payments-service";

export const metadata: Metadata = publicMetadata({
  title: "Контакты и услуги",
  description: "Исполнитель, контакты, платные услуги и цены сайта «Грани» — теста личности по Большой пятёрке.",
  path: "/contacts",
});

const MAIN_PRODUCTS = ["full", "pair", "attachment_solo"] as const satisfies readonly Product[];
const EXTRA_PRODUCTS = (Object.keys(PRODUCT_PRICES) as Product[]).filter(
  (product) => !(MAIN_PRODUCTS as readonly string[]).includes(product),
);

export default function ContactsPage() {
  return (
    <main data-night-entry>
      <NightHero title="Контакты и услуги" eyebrow="Грани">
        <p>
          Исполнитель сайта, способ связаться и платные услуги с ценами.
        </p>
      </NightHero>
      <div className="page inner-text">
      <article className="stack">
        <h2>Исполнитель</h2>
        <p>
          {OPERATOR.name}, самозанятая (плательщик налога на профессиональный доход). ИНН {OPERATOR.inn}.
        </p>
        <p>
          Почта: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Отвечаем в течение двух рабочих дней.
        </p>
        <p>
          {VK_COMMUNITY_LINK.label}:{" "}
          <a href={VK_COMMUNITY_LINK.href} target="_blank" rel="noopener noreferrer">
            {VK_COMMUNITY_LINK.href.replace(/^https:\/\//, "")}
          </a>
          .
        </p>
        <h2>Что это за сайт</h2>
        <p>
          «Грани» — бесплатный тест личности по модели «Большая пятёрка»: 50 утверждений, один из 16 типов, пять шкал и анкета для друзей
          «Как меня видят другие». Платно — подробные текстовые разборы по результату теста. Они открываются на сайте сразу после оплаты.
        </p>
        <h2>Платные услуги</h2>
        <p>Основные разборы:</p>
        <ul>
          {MAIN_PRODUCTS.map((product) => (
            <li key={product}>
              {PRODUCT_DESCRIPTIONS[product]} — {formatRub(PRODUCT_PRICES[product])}
            </li>
          ))}
        </ul>
        <p>Дополнительно (главы, парный разбор привязанности и связанные позиции):</p>
        <ul>
          {EXTRA_PRODUCTS.map((product) => (
            <li key={product}>
              {PRODUCT_DESCRIPTIONS[product]} — {formatRub(PRODUCT_PRICES[product])}
            </li>
          ))}
          <li>
            Доступ к «Грани. Вдвоём» на {TOGETHER_PERIOD_DAYS} дней для двоих — {formatRub(TOGETHER_PRICE_KOPECKS)}
          </li>
        </ul>
        <p>
          Что входит в каждый разбор — на странице <Link href="/pricing">«Разборы и цены»</Link>. Полный перечень цен также в{" "}
          <Link href="/offer">оферте</Link>.
        </p>
        <p>
          Оплата картой через ЮKassa, чек самозанятого из «Мой налог» оформляется после оплаты. Условия, возвраты и порядок оказания — в <Link href="/offer">оферте</Link>,
          обработка данных — в <Link href="/privacy">политике</Link>.
        </p>
      </article>
      </div>
    </main>
  );
}
