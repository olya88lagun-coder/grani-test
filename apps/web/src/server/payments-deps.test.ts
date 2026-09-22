import { expect, test, vi } from "vitest";
import { createGateway } from "./payments-deps";

test("picks the gateway from the settings", async () => {
  const fetchFn = vi.fn();

  expect(createGateway(null, { appUrl: "http://localhost:3000", fetchFn })).toBeNull();
  const fake = createGateway({ kind: "fake" }, { appUrl: "http://localhost:3000", fetchFn })!;
  const payment = await fake.createPayment({ purchaseId: "p-deps", amountKopecks: 100, description: "d", returnUrl: "r" });
  expect(payment.confirmationUrl).toMatch(/^http:\/\/localhost:3000\/dev\/pay\/fake-/);
  expect(createGateway({ kind: "yookassa", shopId: "1", secretKey: "s" }, { appUrl: "x", fetchFn })).not.toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});
