import { z } from "zod";

const VK_COMMUNITY_KEYS = ["VK_GROUP_ID", "VK_CALLBACK_SECRET", "VK_CONFIRMATION_CODE"] as const;

const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  VK_CLIENT_ID: z.string().regex(/^\d+$/),
  VK_GROUP_ID: z.string().regex(/^\d+$/).optional(),
  VK_CALLBACK_SECRET: z.string().min(1).optional(),
  VK_CONFIRMATION_CODE: z.string().min(1).optional(),
});

export type VkCommunityConfig = { groupId: string; callbackSecret: string; confirmationCode: string };
type ParsedEnv = z.infer<typeof envSchema>;
export type AppEnv = Omit<ParsedEnv, (typeof VK_COMMUNITY_KEYS)[number]> & { vkCommunity: VkCommunityConfig | null };

function fail(fields: readonly string[]): never {
  throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
}

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) fail(parsed.error.issues.map((issue) => issue.path.join(".")));
  const { VK_GROUP_ID, VK_CALLBACK_SECRET, VK_CONFIRMATION_CODE, ...rest } = parsed.data;
  const missing = VK_COMMUNITY_KEYS.filter((key) => !parsed.data[key]);
  // Сообщество либо настроено целиком, либо выключено: частичная настройка — ошибка выкладки
  if (missing.length > 0 && missing.length < VK_COMMUNITY_KEYS.length) fail(missing);
  const vkCommunity =
    VK_GROUP_ID && VK_CALLBACK_SECRET && VK_CONFIRMATION_CODE
      ? { groupId: VK_GROUP_ID, callbackSecret: VK_CALLBACK_SECRET, confirmationCode: VK_CONFIRMATION_CODE }
      : null;
  return { ...rest, vkCommunity };
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  cached ??= readEnv();
  return cached;
}
