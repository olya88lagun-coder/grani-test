import { isProduct, type Product } from "@grani/core";

export type ConfirmedPurchase = { id: string; product: Product; amountKopecks: number; currency: "RUB" };

export function isConfirmedPurchase(value: unknown): value is ConfirmedPurchase {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<ConfirmedPurchase>;
  return typeof p.id === "string" && /^order_[a-f0-9]{64}$/.test(p.id) && isProduct(p.product)
    && typeof p.amountKopecks === "number" && Number.isSafeInteger(p.amountKopecks) && p.amountKopecks > 0 && p.currency === "RUB";
}
