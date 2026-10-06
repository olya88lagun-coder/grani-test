import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 18;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function createInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isInviteToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

// Код-ссылка пары для друзей: 10 символов из 32 без похожих (0, 1, l, o), читается с экрана и набирается руками
const SHARE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SHARE_CODE_LENGTH = 10;
const SHARE_PATTERN = /^[a-km-np-z2-9]{10}$/;

export function createShareCode(): string {
  // 32 символа и байт & 31: все значения равновероятны
  return Array.from(randomBytes(SHARE_CODE_LENGTH), (byte) => SHARE_ALPHABET[byte & 31]).join("");
}

export function isShareCode(value: string): boolean {
  return SHARE_PATTERN.test(value);
}
