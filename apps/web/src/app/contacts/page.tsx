import { formatRub, PRODUCT_PRICES, type Product } from "@grani/core";
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/EditorialPage";
import { OPERATOR } from "@/lib/legal";
import { publicMetadata } from "@/lib/seo";
import { PRODUCT_DESCRIPTIONS } from "@/server/payments-service";
import styles from "../editorial.module.css";

export const metadata: Metadata = publicMetadata({
  title: "Контакты и услуги",
  description: "Исполнитель, контакты, платные услуги и цены сайта «Грани» — теста личности по Большой пятёрке.",
  path: "/contacts",
});

const PRODUCTS = Object.keys(PRODUCT_PRICES) as Product[];

export default function ContactsPage() {
  return (
    <EditorialPage title="Контакты и услуги" path="/contacts">
      <h1 className="display">Контакты и услуги</h1>
      <h2>Связаться с нами</h2>
      <p>
        Почта: <a className={styles.contactLink} href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Отвечаем в течение двух рабочих дней.
      </p>
      <h2>Исполнитель</h2>
      <p>
        {OPERATOR.name}, самозанятая (плательщик налога на профессиональный доход). ИНН {OPERATOR.inn}.
      </p>
      <h2>Что это за сайт</h2>
      <p>
        «Грани» — бесплатный тест личности по модели «Большая пятёрка»: 50 утверждений, один из 16 типов, пять шкал и анкета для друзей
        «Как меня видят другие». Платно — подробные текстовые разборы по результату теста. Они открываются на сайте сразу после оплаты.
      </p>
      <h2>Платные услуги</h2>
      <ul className={styles.services}>
        {PRODUCTS.map((product) => (
          <li key={product}>
            <span>{PRODUCT_DESCRIPTIONS[product]}</span><span> — {formatRub(PRODUCT_PRICES[product])}</span>
          </li>
        ))}
      </ul>
      <p>
        Что входит в каждый разбор — на странице <Link href="/pricing">«Разборы и цены»</Link>.
      </p>
      <p>
        Оплата картой через ЮKassa, чек самозанятого из «Мой налог» оформляется после оплаты. Условия, возвраты и порядок оказания — в <Link href="/offer">оферте</Link>,
        обработка данных — в <Link href="/privacy">политике</Link>.
      </p>
    </EditorialPage>
  );
}
