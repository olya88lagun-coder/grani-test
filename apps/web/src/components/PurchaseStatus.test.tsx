import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { PurchaseView } from "@/server/payments-service";
import { PurchaseStatus } from "./PurchaseStatus";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace() {} }) }));
const purchase: PurchaseView = { id: "test-purchase", product: "pair", status: "succeeded", ready: false,
  reportUrl: "/pair/test-pair", free: false, since: new Date().toISOString() };

test("offers the interactive pair map while its additional generated text is preparing", () => {
  const html = renderToStaticMarkup(<PurchaseStatus initial={purchase} />);
  expect(html).toContain('href="/pair/test-pair"');
  expect(html).toContain("Открыть интерактивную карту пары");
});

test.each(["pending", "canceled", "refunded"] as const)("does not promise an open map for %s payment", status => {
  const html = renderToStaticMarkup(<PurchaseStatus initial={{ ...purchase, status }} />);
  expect(html).not.toContain("Открыть интерактивную карту пары");
});

test("does not change the waiting behavior for a personal report", () => {
  const html = renderToStaticMarkup(<PurchaseStatus initial={{ ...purchase, product: "full" }} />);
  expect(html).not.toContain("Открыть интерактивную карту пары");
});
