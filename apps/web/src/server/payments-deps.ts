import { receiptsReminderWindow } from "@grani/core";
import { findUserIdByIdentity, hasIdentity } from "@grani/db";
import { getDb } from "./db";
import { getEnv, type PaymentsConfig } from "./env";
import { createFakeGateway, type FakeGateway } from "./payments/fake";
import type { PaymentGateway } from "./payments/gateway";
import { createYooKassaGateway } from "./payments/yookassa";
import type { PaymentsDeps } from "./payments-service";
import { enqueueGenerate, enqueueNotify } from "./queue";

export function createGateway(config: PaymentsConfig, p: { appUrl: string; fetchFn: typeof fetch }): PaymentGateway | null {
  if (!config) return null;
  if (config.kind === "fake") return createFakeGateway({ appUrl: p.appUrl });
  return createYooKassaGateway({ shopId: config.shopId, secretKey: config.secretKey, fetchFn: p.fetchFn });
}

export function paymentsDeps(): PaymentsDeps | null {
  const env = getEnv();
  const gateway = createGateway(env.payments, { appUrl: env.APP_URL, fetchFn: (input, init) => fetch(input, init) });
  if (!gateway) return null;
  const db = getDb();
  const owner = env.owner;
  const isOwner = async (userId: string) => owner !== null && (await hasIdentity(db, userId, owner));
  // Владелицу сайта находим по OWNER_IDENTITY; без неё напоминать некому, чеки остаются на странице
  const remindReceipts = async (now: Date) => {
    if (owner === null) return;
    const ownerUserId = await findUserIdByIdentity(db, owner);
    if (ownerUserId === null) return;
    const { bucket, delaySeconds } = receiptsReminderWindow(now);
    await enqueueNotify({ kind: "receipts_pending", bucket, ownerUserId }, { startAfterSeconds: delaySeconds });
  };
  return { db, gateway, appUrl: env.APP_URL, now: () => new Date(), enqueueGenerate, remindReceipts, isOwner };
}

export function fakeGateway(): FakeGateway | null {
  const env = getEnv();
  return env.payments?.kind === "fake" ? createFakeGateway({ appUrl: env.APP_URL }) : null;
}
