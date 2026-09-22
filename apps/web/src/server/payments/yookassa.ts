import { kopecksToValue, valueToKopecks, type GatewayPayment, type GatewayStatus, type PaymentGateway } from "./gateway";

export const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";
const STATUSES: readonly GatewayStatus[] = ["pending", "waiting_for_capture", "succeeded", "canceled"];
const NOT_FOUND = 404;

type PaymentBody = {
  id?: unknown;
  status?: unknown;
  paid?: unknown;
  amount?: { value?: unknown };
  metadata?: { purchase_id?: unknown };
  confirmation?: { confirmation_url?: unknown };
};

function parsePayment(body: PaymentBody): GatewayPayment {
  const amountKopecks = valueToKopecks(body.amount?.value);
  if (typeof body.id !== "string" || !STATUSES.includes(body.status as GatewayStatus) || typeof body.paid !== "boolean" || amountKopecks === null) {
    throw new Error("YooKassa returned a malformed payment");
  }
  return {
    id: body.id,
    status: body.status as GatewayStatus,
    paid: body.paid,
    amountKopecks,
    purchaseId: typeof body.metadata?.purchase_id === "string" ? body.metadata.purchase_id : null,
    confirmationUrl: typeof body.confirmation?.confirmation_url === "string" ? body.confirmation.confirmation_url : null,
  };
}

export function createYooKassaGateway(p: { shopId: string; secretKey: string; fetchFn: typeof fetch; apiUrl?: string }): PaymentGateway {
  const base = p.apiUrl ?? YOOKASSA_API_URL;
  const authorization = `Basic ${Buffer.from(`${p.shopId}:${p.secretKey}`).toString("base64")}`;

  return {
    async createPayment(input) {
      const response = await p.fetchFn(`${base}/payments`, {
        method: "POST",
        // Ключ идемпотентности — id покупки: повтор запроса после сбоя сети не создаст второй платёж
        headers: { authorization, "idempotence-key": input.purchaseId, "content-type": "application/json" },
        body: JSON.stringify({
          amount: { value: kopecksToValue(input.amountKopecks), currency: "RUB" },
          capture: true,
          confirmation: { type: "redirect", return_url: input.returnUrl },
          description: input.description,
          metadata: { purchase_id: input.purchaseId },
        }),
      });
      if (!response.ok) throw new Error(`YooKassa create payment responded ${response.status}`);
      return parsePayment((await response.json()) as PaymentBody);
    },
    async getPayment(paymentId) {
      const response = await p.fetchFn(`${base}/payments/${encodeURIComponent(paymentId)}`, { headers: { authorization } });
      if (response.status === NOT_FOUND) return null;
      if (!response.ok) throw new Error(`YooKassa get payment responded ${response.status}`);
      return parsePayment((await response.json()) as PaymentBody);
    },
  };
}
