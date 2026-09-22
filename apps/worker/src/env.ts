import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url(),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/).optional(),
  VK_GROUP_TOKEN: z.string().min(1).optional(),
  NOTIFICATIONS_DRY_RUN: z.enum(["0", "1"]).optional(),
  // Локальная PGlite-БД путает одновременные запросы с разных соединений: там DATABASE_POOL_MAX=1, как у сайта
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(3),
  AI_PROVIDER: z.enum(["none", "yandex", "gigachat"]).default("none"),
  YANDEX_API_KEY: z.string().min(1).optional(),
  YANDEX_FOLDER_ID: z.string().min(1).optional(),
  GIGACHAT_AUTH_KEY: z.string().min(1).optional(),
  GIGACHAT_SCOPE: z.string().min(1).default("GIGACHAT_API_PERS"),
});

export type AiConfig = { provider: "none" } | { provider: "yandex"; apiKey: string; folderId: string } | { provider: "gigachat"; authKey: string; scope: string };

function readAi(env: z.infer<typeof schema>): AiConfig {
  if (env.AI_PROVIDER === "yandex") {
    const missing = [!env.YANDEX_API_KEY && "YANDEX_API_KEY", !env.YANDEX_FOLDER_ID && "YANDEX_FOLDER_ID"].filter(Boolean);
    if (missing.length > 0) throw new Error(`Invalid worker environment variables: ${missing.join(", ")}`);
    return { provider: "yandex", apiKey: env.YANDEX_API_KEY!, folderId: env.YANDEX_FOLDER_ID! };
  }
  if (env.AI_PROVIDER === "gigachat") {
    if (!env.GIGACHAT_AUTH_KEY) throw new Error("Invalid worker environment variables: GIGACHAT_AUTH_KEY");
    return { provider: "gigachat", authKey: env.GIGACHAT_AUTH_KEY, scope: env.GIGACHAT_SCOPE };
  }
  return { provider: "none" };
}

export type WorkerEnv = { DATABASE_URL: string; APP_URL: string; telegramToken: string | null; vkGroupToken: string | null; dryRun: boolean; poolMax: number; ai: AiConfig };

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid worker environment variables: ${fields}`);
  }
  const env = parsed.data;
  return {
    DATABASE_URL: env.DATABASE_URL,
    APP_URL: env.APP_URL,
    telegramToken: env.TELEGRAM_BOT_TOKEN ?? null,
    vkGroupToken: env.VK_GROUP_TOKEN ?? null,
    dryRun: env.NOTIFICATIONS_DRY_RUN === "1",
    poolMax: env.DATABASE_POOL_MAX,
    ai: readAi(env),
  };
}
