import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;

export type TelegramUser = { id: number; firstName: string; lastName: string | null; username: string | null };

export type TelegramVerifyResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };

const optional = (value: string | undefined) => (value !== undefined && value.length > 0 ? value : null);

export function verifyTelegramLoginWidget(
  params: URLSearchParams,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "MISSING_HASH" };
  const fields = new Map<string, string>();
  for (const [key, value] of params) if (key !== "hash") fields.set(key, value);
  const dataCheckString = [...fields.keys()]
    .sort()
    .map((key) => `${key}=${fields.get(key)}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "BAD_HASH" };

  const authDate = Number(fields.get("auth_date"));
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > maxAgeSeconds) return { ok: false, reason: "EXPIRED" };

  const id = Number(fields.get("id"));
  const firstName = fields.get("first_name");
  if (!Number.isSafeInteger(id) || !firstName) return { ok: false, reason: "MALFORMED" };
  return {
    ok: true,
    user: { id, firstName, lastName: optional(fields.get("last_name")), username: optional(fields.get("username")) },
  };
}
