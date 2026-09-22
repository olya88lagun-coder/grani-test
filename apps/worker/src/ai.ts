import { createGigaChatWriter, createYandexWriter, type ReportWriter } from "@grani/ai";
import type { AiConfig } from "./env";

// Без провайдера разборы собираются из блоков — так работает локальная разработка
export function createWriter(config: AiConfig, fetchFn: typeof fetch): ReportWriter | null {
  if (config.provider === "yandex") return createYandexWriter({ apiKey: config.apiKey, folderId: config.folderId, fetchFn });
  if (config.provider === "gigachat") return createGigaChatWriter({ authKey: config.authKey, scope: config.scope, fetchFn });
  return null;
}
