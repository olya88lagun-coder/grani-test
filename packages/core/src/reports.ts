import { MIN_FRIENDS } from "./friends";
import { CHAPTER_PRODUCTS, type Product } from "./pricing";

export const REPORT_KINDS = ["full", "friends", "chapter_money", "chapter_conflict", "chapter_stress", "chapter_relationships", "pair"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export type ChapterKind = (typeof CHAPTER_PRODUCTS)[number];
export const CHAPTER_KINDS: readonly ChapterKind[] = CHAPTER_PRODUCTS;
export type ProductTarget = "result" | "pair";

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && (REPORT_KINDS as readonly string[]).includes(value);
}

export function productTarget(product: Product): ProductTarget {
  return product === "pair" ? "pair" : "result";
}

// Имена продуктов и разборов совпадают, кроме набора из четырёх глав
export function reportKindsFor(product: Product): readonly ReportKind[] {
  return product === "chapters_all" ? CHAPTER_KINDS : [product];
}

export function unlockedKinds(owned: readonly Product[]): ReadonlySet<ReportKind> {
  return new Set(owned.flatMap(reportKindsFor));
}

export function canBuy(product: Product, owned: readonly Product[]): boolean {
  const unlocked = unlockedKinds(owned);
  if (product === "full" || product === "pair") return !unlocked.has(product);
  if (!unlocked.has("full")) return false;
  // Набор дешевле четырёх глав, поэтому продаётся только тому, у кого ещё нет ни одной
  if (product === "chapters_all") return CHAPTER_KINDS.every((kind) => !unlocked.has(kind));
  return !unlocked.has(product);
}

export function friendsReportDue(owned: readonly Product[], friendsCount: number): boolean {
  return unlockedKinds(owned).has("full") && friendsCount >= MIN_FRIENDS;
}
