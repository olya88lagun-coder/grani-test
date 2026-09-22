import type { AuthProvider } from "@grani/db";
import type { Logger } from "./log";

export type SendOutcome = "sent" | "rejected" | "failed";
export type Sender = (externalId: string, text: string) => Promise<SendOutcome>;
export type Senders = Partial<Record<AuthProvider, Sender>>;

// Локально сообщения не уходят наружу: токен бота в .env.development.local ненастоящий
export function dryRunSender(provider: AuthProvider, log: Logger): Sender {
  return async (externalId, text) => {
    log("info", "dry run notification", { provider, externalIdLength: externalId.length, text });
    return "sent";
  };
}
