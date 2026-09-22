import { getDb } from "./db";
import { getEnv, type PaymentsConfig } from "./env";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { PaymentGateway } from "./payments/gateway";
import { createYooKassaGateway } from "./payments/yookassa";
import type { PaymentsDeps } from "./payments-service";
import { enqueueGenerate } from "./queue";

export function createGateway(config: PaymentsConfig, p: { appUrl: string; fetchFn: typeof fetch }): PaymentGateway | null {
  if (!config) return null;
  if (config.kind === "fake") return createFakeGateway({ appUrl: p.appUrl });
  return createYooKassaGateway({ shopId: config.shopId, secretKey: config.secretKey, fetchFn: p.fetchFn });
}

export function paymentsDeps(): PaymentsDeps | null {
  const env = getEnv();
  const gateway = createGateway(env.payments, { appUrl: env.APP_URL, fetchFn: (input, init) => fetch(input, init) });
  if (!gateway) return null;
  return { db: getDb(), gateway, appUrl: env.APP_URL, now: () => new Date(), enqueueGenerate };
}

export function fakeGateway(): FakeGateway | null {
  const env = getEnv();
  return env.payments?.kind === "fake" ? createFakeGateway({ appUrl: env.APP_URL }) : null;
}
