import { expect, test } from "vitest";
import { createInviteToken, isInviteToken } from "./tokens";

test("invite tokens are 24 url-safe characters and unique", () => {
  const tokens = new Set(Array.from({ length: 50 }, createInviteToken));

  expect(tokens.size).toBe(50);
  for (const token of tokens) expect(isInviteToken(token)).toBe(true);
});

test.each(["", "short", "a".repeat(25), "../../etc/passwd/aaaaaaa", "aaaaaaaaaaaaaaaaaaaaaa=="])("rejects %j", (value) => {
  expect(isInviteToken(value)).toBe(false);
});
