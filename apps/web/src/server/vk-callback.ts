import { timingSafeEqual } from "node:crypto";
import { setCanNotify, type Database } from "@grani/db";
import type { VkCommunityConfig } from "./env";

export type CallbackReply = { status: number; body: string };

const OK: CallbackReply = { status: 200, body: "ok" };
const FORBIDDEN: CallbackReply = { status: 403, body: "forbidden" };

type Payload = { type?: unknown; group_id?: unknown; secret?: unknown; object?: Record<string, unknown> };

function sameSecret(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function vkUserId(value: unknown): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

async function allow(db: Database, userId: string | null, canNotify: boolean): Promise<void> {
  if (userId) await setCanNotify(db, { provider: "vk", externalId: userId, canNotify });
}

export async function handleVkCallback(db: Database, config: VkCommunityConfig, payload: unknown): Promise<CallbackReply> {
  if (typeof payload !== "object" || payload === null) return FORBIDDEN;
  const event = payload as Payload;
  if (String(event.group_id) !== config.groupId) return FORBIDDEN;
  if (event.type === "confirmation") return { status: 200, body: config.confirmationCode };
  if (!sameSecret(event.secret, config.callbackSecret)) return FORBIDDEN;

  const object = event.object ?? {};
  if (event.type === "message_allow") await allow(db, vkUserId(object.user_id), true);
  if (event.type === "message_deny") await allow(db, vkUserId(object.user_id), false);
  if (event.type === "message_new") {
    const message = object.message as { from_id?: unknown } | undefined;
    await allow(db, vkUserId(message?.from_id), true);
  }
  return OK;
}
