import { describe, expect, test } from "vitest";
import { readEnv } from "./env";

const VALID = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://u:p@db:5432/grani",
  SESSION_SECRET: "x".repeat(32),
  VK_CLIENT_ID: "54770000",
};

const OPEN = { mode: "open", pilotCode: null, pilotLimit: 40 };

describe("readEnv", () => {
  test("accepts a complete environment", () => {
    expect(readEnv(VALID)).toEqual({ ...VALID, vkCommunity: null, payments: null, owner: null, together: OPEN });
  });

  test("names the invalid variables without printing their values", () => {
    const run = () => readEnv({ ...VALID, SESSION_SECRET: "short", VK_CLIENT_ID: undefined });

    expect(run).toThrow(/SESSION_SECRET/);
    expect(run).toThrow(/VK_CLIENT_ID/);
    expect(run).not.toThrow(/short/);
  });
});

describe("Telegram settings", () => {
  test("are ignored: there is no Telegram login", () => {
    expect(readEnv({ ...VALID, TELEGRAM_BOT_TOKEN: "123456:ABC-def_1", TELEGRAM_BOT_USERNAME: "test_grani_bot" })).toEqual({
      ...VALID,
      vkCommunity: null,
      payments: null,
      owner: null,
      together: OPEN,
    });
  });

  test("a Telegram owner identity is refused", () => {
    expect(() => readEnv({ ...VALID, OWNER_IDENTITY: "telegram:42" })).toThrow(/OWNER_IDENTITY/);
    expect(readEnv({ ...VALID, OWNER_IDENTITY: "vk:42" }).owner).toEqual({ provider: "vk", externalId: "42" });
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

describe("owner account", () => {
  test("is off when not configured", () => {
    expect(readEnv(VALID).owner).toBeNull();
  });

  test("is read as provider and id", () => {
    expect(readEnv({ ...VALID, OWNER_IDENTITY: "vk:466855893" }).owner).toEqual({ provider: "vk", externalId: "466855893" });
  });

  test("rejects an unknown provider or a bare id", () => {
    expect(() => readEnv({ ...VALID, OWNER_IDENTITY: "466855893" })).toThrow(/OWNER_IDENTITY/);
    expect(() => readEnv({ ...VALID, OWNER_IDENTITY: "ok:1" })).toThrow(/OWNER_IDENTITY/);
  });
});

describe("Together access mode", () => {
  test("is open outside production and closed in production until it is set", () => {
    expect(readEnv({ ...VALID, NODE_ENV: "development" }).together).toEqual(OPEN);
    expect(readEnv({ ...VALID, NODE_ENV: "production" }).together).toEqual({ mode: "off", pilotCode: null, pilotLimit: 40 });
  });

  test("the pilot needs a code of at least twelve characters", () => {
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "pilot" })).toThrow(/TOGETHER_PILOT_CODE/);
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "pilot", TOGETHER_PILOT_CODE: "short" })).toThrow(/TOGETHER_PILOT_CODE/);
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "pilot", TOGETHER_PILOT_CODE: "granitsa-26" })).toThrow(/TOGETHER_PILOT_CODE/);
    expect(readEnv({ ...VALID, TOGETHER_MODE: "pilot", TOGETHER_PILOT_CODE: "granitsa-2026", TOGETHER_PILOT_LIMIT: "20" }).together).toEqual({
      mode: "pilot",
      pilotCode: "granitsa-2026",
      pilotLimit: 20,
    });
  });

  test("an unknown mode or a bad limit is refused, and the code is not printed", () => {
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "beta" })).toThrow(/TOGETHER_MODE/);
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "pilot", TOGETHER_PILOT_CODE: "granitsa-2026", TOGETHER_PILOT_LIMIT: "0" })).toThrow(/TOGETHER_PILOT_LIMIT/);
    expect(() => readEnv({ ...VALID, TOGETHER_MODE: "pilot", TOGETHER_PILOT_CODE: "short1" })).not.toThrow(/short1/);
  });

  test("a code set while the mode is not pilot is kept out of the settings", () => {
    expect(readEnv({ ...VALID, TOGETHER_MODE: "open", TOGETHER_PILOT_CODE: "granitsa-2026" }).together.pilotCode).toBeNull();
  });
});
