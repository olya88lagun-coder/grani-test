export const PRODUCT_PRICES = {
  full: 29900,
  chapter_money: 9900,
  chapter_conflict: 9900,
  chapter_stress: 9900,
  chapter_relationships: 9900,
  chapters_all: 24900,
  pair: 39900,
} as const;

export type Product = keyof typeof PRODUCT_PRICES;

export const CHAPTER_PRODUCTS = ["chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships"] as const;

const KOPECKS_PER_RUBLE = 100;
const NBSP = " ";

export function isProduct(value: unknown): value is Product {
  return typeof value === "string" && Object.hasOwn(PRODUCT_PRICES, value);
}

export function formatRub(kopecks: number): string {
  if (!Number.isInteger(kopecks) || kopecks < 0 || kopecks % KOPECKS_PER_RUBLE !== 0) {
    throw new Error(`Expected a non-negative whole-ruble amount in kopecks, got ${kopecks}`);
  }
  const rubles = kopecks / KOPECKS_PER_RUBLE;
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${grouped}${NBSP}₽`;
}
