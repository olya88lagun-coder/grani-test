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
  YOOKASSA_SHOP_ID: z.string().regex(/^\d+$/).optional(),
  YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
  PAYMENTS_FAKE: z.enum(["0", "1"]).optional(),
  NODE_ENV: z.string().optional(),
});

export type VkCommunityConfig = { groupId: string; callbackSecret: string; confirmationCode: string };
type ParsedEnv = z.infer<typeof envSchema>;
export type PaymentsConfig = { kind: "yookassa"; shopId: string; secretKey: string } | { kind: "fake" } | null;
const PAYMENT_KEYS = ["YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "PAYMENTS_FAKE", "NODE_ENV"] as const;
export type AppEnv = Omit<ParsedEnv, (typeof VK_COMMUNITY_KEYS)[number] | (typeof PAYMENT_KEYS)[number]> & {
  vkCommunity: VkCommunityConfig | null;
  payments: PaymentsConfig;
};

function fail(fields: readonly string[]): never {
  throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
}

function readPayments(env: ParsedEnv): PaymentsConfig {
  // Поддельная оплата — только для разработки и сквозных тестов, как dev-вход
  if (env.PAYMENTS_FAKE === "1") {
    if (env.NODE_ENV === "production") fail(["PAYMENTS_FAKE"]);
    return { kind: "fake" };
  }
  if (env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY) return { kind: "yookassa", shopId: env.YOOKASSA_SHOP_ID, secretKey: env.YOOKASSA_SECRET_KEY };
  if (env.YOOKASSA_SHOP_ID || env.YOOKASSA_SECRET_KEY) fail(env.YOOKASSA_SHOP_ID ? ["YOOKASSA_SECRET_KEY"] : ["YOOKASSA_SHOP_ID"]);
  return null;
}

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) fail(parsed.error.issues.map((issue) => issue.path.join(".")));
  const { VK_GROUP_ID, VK_CALLBACK_SECRET, VK_CONFIRMATION_CODE, YOOKASSA_SHOP_ID: _shop, YOOKASSA_SECRET_KEY: _key, PAYMENTS_FAKE: _fake, NODE_ENV: _nodeEnv, ...rest } = parsed.data;
  const missing = VK_COMMUNITY_KEYS.filter((key) => !parsed.data[key]);
  // Сообщество либо настроено целиком, либо выключено: частичная настройка — ошибка выкладки
  if (missing.length > 0 && missing.length < VK_COMMUNITY_KEYS.length) fail(missing);
  const vkCommunity =
    VK_GROUP_ID && VK_CALLBACK_SECRET && VK_CONFIRMATION_CODE
      ? { groupId: VK_GROUP_ID, callbackSecret: VK_CALLBACK_SECRET, confirmationCode: VK_CONFIRMATION_CODE }
      : null;
  return { ...rest, vkCommunity, payments: readPayments(parsed.data) };
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  cached ??= readEnv();
  return cached;
}
