import { PRODUCT_PRICES } from "@grani/core";
import { ANALYTICS_READY_EVENT, goalForProduct, isOwnerDevice, reachGoal, readChoice } from "./analytics";
import type { PurchaseView } from "@/server/payments-service";

const pendingGoals = new Set<string>();

// The listener outlives the purchase component, so an early client navigation cannot lose the goal.
export function markPurchase(view: PurchaseView): void {
  if (view.status !== "succeeded" || view.free) return;
  const choice = readChoice(window.localStorage);
  if (choice === "necessary" || isOwnerDevice(window.localStorage)) return;
  const key = `grani-goal-${view.id}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
  } catch {
    // Storage can be disabled; a confirmed goal can still be sent with consent.
  }
  if (typeof (window as Window & { ym?: unknown }).ym !== "function") {
    if (choice !== "all" || pendingGoals.has(view.id)) return;
    pendingGoals.add(view.id);
    window.addEventListener(ANALYTICS_READY_EVENT, () => {
      pendingGoals.delete(view.id);
      markPurchase(view);
    }, { once: true });
    return;
  }
  reachGoal(goalForProduct(view.product), { order_price: PRODUCT_PRICES[view.product] / 100, currency: "RUB" });
  try { window.sessionStorage.setItem(key, "1"); } catch { /* Sending the goal must not break a paid page. */ }
}
