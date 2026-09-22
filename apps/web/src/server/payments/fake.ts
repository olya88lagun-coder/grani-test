import { randomUUID } from "node:crypto";
import type { GatewayPayment, PaymentGateway } from "./gateway";

export type FakeGateway = PaymentGateway & { complete(paymentId: string, outcome: "succeeded" | "canceled"): boolean };

// Платежи живут в памяти процесса; globalThis переживает перезагрузку модулей в next dev
const holder = globalThis as typeof globalThis & { __graniFakePayments?: Map<string, GatewayPayment> };

export function createFakeGateway(p: { appUrl: string; store?: Map<string, GatewayPayment> }): FakeGateway {
  const store = p.store ?? (holder.__graniFakePayments ??= new Map());
  return {
    async createPayment(input) {
      const existing = [...store.values()].find((payment) => payment.purchaseId === input.purchaseId);
      if (existing) return existing;
      const id = `fake-${randomUUID()}`;
      const payment: GatewayPayment = {
        id,
        status: "pending",
        paid: false,
        amountKopecks: input.amountKopecks,
        purchaseId: input.purchaseId,
        confirmationUrl: new URL(`/dev/pay/${id}`, p.appUrl).toString(),
      };
      store.set(id, payment);
      return payment;
    },
    async getPayment(paymentId) {
      return store.get(paymentId) ?? null;
    },
    complete(paymentId, outcome) {
      const payment = store.get(paymentId);
      if (!payment) return false;
      store.set(paymentId, { ...payment, status: outcome, paid: outcome === "succeeded" });
      return true;
    },
  };
}
