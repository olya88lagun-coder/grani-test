export type GatewayStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";
export type GatewayPayment = {
  id: string;
  status: GatewayStatus;
  paid: boolean;
  amountKopecks: number;
  purchaseId: string | null;
  confirmationUrl: string | null;
};
export type CreatePaymentInput = { purchaseId: string; amountKopecks: number; description: string; returnUrl: string };
export type PaymentGateway = {
  createPayment(input: CreatePaymentInput): Promise<GatewayPayment>;
  getPayment(paymentId: string): Promise<GatewayPayment | null>;
};

const KOPECKS = 100;

export function kopecksToValue(kopecks: number): string {
  return (kopecks / KOPECKS).toFixed(2);
}

export function valueToKopecks(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * KOPECKS);
}
