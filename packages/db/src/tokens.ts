import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 18;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export function createInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isInviteToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
