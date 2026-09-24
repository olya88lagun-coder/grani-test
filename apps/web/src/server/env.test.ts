import { describe, expect, test } from "vitest";
import { readEnv } from "./env";

const VALID = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://u:p@db:5432/grani",
  SESSION_SECRET: "x".repeat(32),
  VK_CLIENT_ID: "54770000",
};

describe("readEnv", () => {
  test("accepts a complete environment", () => {
    expect(readEnv(VALID)).toEqual({ ...VALID, telegram: null, vkCommunity: null, payments: null });
  });

  test("names the invalid variables without printing their values", () => {
    const run = () => readEnv({ ...VALID, SESSION_SECRET: "short", VK_CLIENT_ID: undefined });

    expect(run).toThrow(/SESSION_SECRET/);
    expect(run).toThrow(/VK_CLIENT_ID/);
    expect(run).not.toThrow(/short/);
  });
});

describe("Telegram login", () => {
  const TG = { TELEGRAM_BOT_TOKEN: "123456:ABC-def_1", TELEGRAM_BOT_USERNAME: "test_grani_bot" };

  test("is off when the bot is not configured", () => {
    expect(readEnv(VALID).telegram).toBeNull();
  });

  test("is read from both variables together", () => {
    expect(readEnv({ ...VALID, ...TG }).telegram).toEqual({ botToken: "123456:ABC-def_1", botUsername: "test_grani_bot" });
  });

  test("fails when only one of them is set", () => {
    expect(() => readEnv({ ...VALID, TELEGRAM_BOT_TOKEN: "123456:ABC-def_1" })).toThrow(/TELEGRAM_BOT_USERNAME/);
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

describe("payment settings", () => {
  test("read YooKassa keys together", () => {
    expect(readEnv({ ...VALID, YOOKASSA_SHOP_ID: "123456", YOOKASSA_SECRET_KEY: "live_x" }).payments).toEqual({ kind: "yookassa", shopId: "123456", secretKey: "live_x" });
    expect(() => readEnv({ ...VALID, YOOKASSA_SHOP_ID: "123456" })).toThrow(/YOOKASSA_SECRET_KEY/);
  });

  test("fake payments work only outside production", () => {
    expect(readEnv({ ...VALID, PAYMENTS_FAKE: "1", NODE_ENV: "development" }).payments).toEqual({ kind: "fake" });
    expect(() => readEnv({ ...VALID, PAYMENTS_FAKE: "1", NODE_ENV: "production" })).toThrow(/PAYMENTS_FAKE/);
  });
});
