import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { PurchaseView } from "@/server/payments-service";
import { PurchaseStatus } from "./PurchaseStatus";

const effects = vi.hoisted(() => ({
  callbacks: [] as Array<() => void | (() => void)>,
  mark: vi.fn(), replace: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (callback: () => void | (() => void)) => { effects.callbacks.push(callback); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: effects.replace }) }));
vi.mock("@/lib/purchase-analytics", () => ({ markPurchase: effects.mark }));
const purchase: PurchaseView = {
  id: "test-purchase", product: "full", status: "succeeded", ready: false,
  reportUrl: "/report/private", free: false, since: new Date().toISOString(),
};
beforeEach(() => { effects.callbacks.length = 0; vi.clearAllMocks(); effects.mark.mockResolvedValue(undefined); });
function runEffects(view: PurchaseView) {
  renderToStaticMarkup(<PurchaseStatus initial={view} />);
  for (const effect of effects.callbacks) {
    const cleanup = effect();
    if (typeof cleanup === "function") cleanup();
  }
}
test.each(["full", "chapter_money", "chapters_all", "pair"] as const)("a paid %s starts analytics before report readiness", product => {
  runEffects({ ...purchase, product });
  expect(effects.mark).toHaveBeenCalledExactlyOnceWith({ ...purchase, product });
  expect(effects.replace).not.toHaveBeenCalled();
});
test.each(["pending", "canceled", "refunded"] as const)("%s never starts purchase analytics", status => {
  runEffects({ ...purchase, status });
  expect(effects.mark).not.toHaveBeenCalled();
});
test("opening the paid report does not await analytics or the payment provider", () => {
  effects.mark.mockReturnValue(new Promise(() => {}));
  runEffects({ ...purchase, ready: true });
  expect(effects.replace).toHaveBeenCalledExactlyOnceWith("/report/private");
});
