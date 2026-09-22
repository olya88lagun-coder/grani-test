import { expect, test } from "vitest";
import { createFakeGateway } from "./fake";

const INPUT = { purchaseId: "p1", amountKopecks: 29900, description: "d", returnUrl: "http://localhost:3000/purchases/p1" };

test("a fake payment waits for the developer's decision on a local page", async () => {
  const gateway = createFakeGateway({ appUrl: "http://localhost:3000", store: new Map() });

  const payment = await gateway.createPayment(INPUT);

  expect(payment).toMatchObject({ status: "pending", paid: false, amountKopecks: 29900, purchaseId: "p1" });
  expect(payment.confirmationUrl).toBe(`http://localhost:3000/dev/pay/${payment.id}`);
  expect((await gateway.createPayment(INPUT)).id).toBe(payment.id);
  expect(gateway.complete(payment.id, "succeeded")).toBe(true);
  expect(await gateway.getPayment(payment.id)).toMatchObject({ status: "succeeded", paid: true });
  expect(gateway.complete("missing", "canceled")).toBe(false);
  expect(await gateway.getPayment("missing")).toBeNull();
});
