import { describe, expect, test } from "vitest";
import { readEnv } from "./env";

const VALID = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://u:p@db:5432/grani",
  SESSION_SECRET: "x".repeat(32),
  TELEGRAM_BOT_TOKEN: "123456:ABC-def_1",
  TELEGRAM_BOT_USERNAME: "test_grani_bot",
  VK_CLIENT_ID: "54770000",
};

describe("readEnv", () => {
  test("accepts a complete environment", () => {
    expect(readEnv(VALID)).toEqual({ ...VALID, vkCommunity: null });
  });

  test("names the invalid variables without printing their values", () => {
    const run = () => readEnv({ ...VALID, SESSION_SECRET: "short", VK_CLIENT_ID: undefined });

    expect(run).toThrow(/SESSION_SECRET/);
    expect(run).toThrow(/VK_CLIENT_ID/);
    expect(run).not.toThrow(/short/);
  });
});

describe("VK community settings", () => {
  const VK = { VK_GROUP_ID: "230000000", VK_CALLBACK_SECRET: "cb-secret", VK_CONFIRMATION_CODE: "a1b2c3" };

  test("are off when not configured", () => {
    expect(readEnv(VALID).vkCommunity).toBeNull();
  });

  test("are read together", () => {
    expect(readEnv({ ...VALID, ...VK }).vkCommunity).toEqual({ groupId: "230000000", callbackSecret: "cb-secret", confirmationCode: "a1b2c3" });
  });

  test("fail when only some are set", () => {
    expect(() => readEnv({ ...VALID, VK_GROUP_ID: "230000000" })).toThrow(/VK_CALLBACK_SECRET/);
  });
});
