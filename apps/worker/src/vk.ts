import { randomInt } from "node:crypto";
import type { Sender, SendOutcome } from "./senders";

export const VK_API_VERSION = "5.199";
const VK_API_URL = "https://api.vk.ru/method/messages.send";
// 901 — пользователь запретил сообщения сообщества, 902 — настройки приватности, 7 — у ключа нет прав
const PERMANENT_ERRORS = new Set([7, 901, 902]);
const MAX_RANDOM_ID = 2 ** 31 - 1;

export function createVkSender(p: { token: string; fetchFn: typeof fetch; randomId?: () => number }): Sender {
  const randomId = p.randomId ?? (() => randomInt(MAX_RANDOM_ID));
  return async (externalId, text): Promise<SendOutcome> => {
    try {
      const response = await p.fetchFn(VK_API_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ user_id: externalId, random_id: String(randomId()), message: text, access_token: p.token, v: VK_API_VERSION }).toString(),
      });
      const body = (await response.json()) as { response?: unknown; error?: { error_code?: number } };
      if (body.response !== undefined) return "sent";
      return PERMANENT_ERRORS.has(body.error?.error_code ?? -1) ? "rejected" : "failed";
    } catch {
      return "failed";
    }
  };
}
