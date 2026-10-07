import { expect, test } from "vitest";
import { createInviteToken, createShareCode, isInviteToken, isShareCode } from "./tokens";

test("invite tokens are 24 url-safe characters and unique", () => {
  const tokens = new Set(Array.from({ length: 50 }, createInviteToken));

  expect(tokens.size).toBe(50);
  for (const token of tokens) expect(isInviteToken(token)).toBe(true);
});

test.each(["", "short", "a".repeat(25), "../../etc/passwd/aaaaaaa", "aaaaaaaaaaaaaaaaaaaaaa=="])("rejects %j", (value) => {
  expect(isInviteToken(value)).toBe(false);
});

test("share codes are ten easy-to-read characters and unique", () => {
  const codes = new Set(Array.from({ length: 200 }, createShareCode));

  expect(codes.size).toBe(200);
  for (const code of codes) expect(isShareCode(code)).toBe(true);
});

test.each(["", "short", "a".repeat(11), "ABCDEFGHJK", "abcdefghi0", "abcdefghi1", "abcdefghil", "abcdefghio", "../../etc/p"])("rejects the share code %j", (value) => {
  expect(isShareCode(value)).toBe(false);
});
