import { GrammyError } from "grammy";
import type { Sender, SendOutcome } from "./senders";

type TelegramApi = { sendMessage(chatId: string, text: string, other?: object): Promise<unknown> };

// 403 — пользователь заблокировал бота или не разрешил ему писать; 400 — чат не найден. Повтор не поможет
export function telegramOutcome(error: unknown): SendOutcome {
  if (error instanceof GrammyError && (error.error_code === 400 || error.error_code === 403)) return "rejected";
  return "failed";
}

export function createTelegramSender(api: TelegramApi): Sender {
  return async (externalId, text) => {
    try {
      await api.sendMessage(externalId, text, { link_preview_options: { is_disabled: true } });
      return "sent";
    } catch (error) {
      return telegramOutcome(error);
    }
  };
}
