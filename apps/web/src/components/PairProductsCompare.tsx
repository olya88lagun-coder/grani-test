import Link from "next/link";
import { PAIR_PRODUCTS, PAIR_PRODUCTS_CHOICE, PAIR_PRODUCTS_HOW_TO_CHOOSE_TITLE, type PairProductKey } from "@/lib/pair-products";

type Props = { prices: Readonly<Record<PairProductKey, string>>; current?: PairProductKey; headingId: string };

// Сравнение двух продуктов для пары. current подсвечивает продукт страницы, второй получает ссылку
export function PairProductsCompare({ prices, current, headingId }: Props) {
  const products = [PAIR_PRODUCTS.compatibility, PAIR_PRODUCTS.together];
  return (
    <section className="inner-block stack" aria-labelledby={headingId}>
      <h2 id={headingId}>{PAIR_PRODUCTS_HOW_TO_CHOOSE_TITLE}</h2>
      <div className="pricing-grid">
        {products.map((product) => (
          <section key={product.key} className="card stack" aria-label={product.title}>
            <h3>{product.title}</h3>
            <p>{product.summary}</p>
            <ul className="pricing-card__list">
              <li>{product.needsTest}</li>
              <li>{product.period}</li>
              <li>{prices[product.key]}</li>
            </ul>
            {product.key !== current && (
              <Link className="button button--ghost" href={product.href}>
                Подробнее <span aria-hidden="true">→</span>
              </Link>
            )}
          </section>
        ))}
      </div>
      <p className="muted">{PAIR_PRODUCTS_CHOICE}</p>
    </section>
  );
}
