import { describe, expect, test, vi } from "vitest";
import { createYooKassaGateway, YOOKASSA_API_URL } from "./yookassa";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PAYMENT = {
  id: "2c5a-pay",
  status: "pending",
  paid: false,
  amount: { value: "299.00", currency: "RUB" },
  metadata: { purchase_id: "purchase-1" },
  confirmation: { type: "redirect", confirmation_url: "https://yoomoney.ru/checkout/payments/v2/contract?orderId=2c5a-pay" },
};

describe("createYooKassaGateway", () => {
  test("creates a captured redirect payment with the purchase as the idempotence key", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(PAYMENT));
    const gateway = createYooKassaGateway({ shopId: "123", secretKey: "test_secret", fetchFn });

    const payment = await gateway.createPayment({ purchaseId: "purchase-1", amountKopecks: 29900, description: "Полный разбор", returnUrl: "https://grani-test.ru/purchases/purchase-1" });

    expect(payment).toEqual({ id: "2c5a-pay", status: "pending", paid: false, amountKopecks: 29900, purchaseId: "purchase-1", confirmationUrl: PAYMENT.confirmation.confirmation_url });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${YOOKASSA_API_URL}/payments`);
    expect(init.headers).toMatchObject({ authorization: `Basic ${Buffer.from("123:test_secret").toString("base64")}`, "idempotence-key": "purchase-1" });
    expect(JSON.parse(init.body as string)).toEqual({
      amount: { value: "299.00", currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: "https://grani-test.ru/purchases/purchase-1" },
      description: "Полный разбор",
      metadata: { purchase_id: "purchase-1" },
    });
  });

  test("reads a payment, unknown payments are null, errors throw", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(json({ ...PAYMENT, status: "succeeded", paid: true, confirmation: undefined })).mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 500));
    const gateway = createYooKassaGateway({ shopId: "1", secretKey: "s", fetchFn });

    expect(await gateway.getPayment("2c5a-pay")).toMatchObject({ status: "succeeded", paid: true, confirmationUrl: null });
    expect(fetchFn.mock.calls[0]![0]).toBe(`${YOOKASSA_API_URL}/payments/2c5a-pay`);
    expect(await gateway.getPayment("missing")).toBeNull();
    await expect(gateway.getPayment("broken")).rejects.toThrow(/500/);
  });

  test("rejects a malformed payment body", async () => {
    const gateway = createYooKassaGateway({ shopId: "1", secretKey: "s", fetchFn: vi.fn().mockResolvedValue(json({ id: 1 })) });

    await expect(gateway.getPayment("x")).rejects.toThrow(/malformed/);
  });
});
