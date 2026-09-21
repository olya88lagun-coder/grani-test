import { createHmac, randomUUID } from "node:crypto";
import type { CookieOptions } from "./http";

export const DEVICE_COOKIE = "grani_device";
const DEVICE_MAX_AGE_SECONDS = 365 * 86400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newDeviceId(): string {
  return randomUUID();
}

export function isDeviceId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// В базе только HMAC метки: по базе нельзя узнать, какому браузеру принадлежит ответ
export function deviceHash(secret: string, deviceId: string): string {
  return createHmac("sha256", secret).update(`device:${deviceId}`).digest("hex");
}

export function deviceCookieOptions(appUrl: string): CookieOptions {
  return { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE_SECONDS };
}
