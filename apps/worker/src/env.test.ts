import { expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const BASE = { DATABASE_URL: "postgres://u:p@db/grani", APP_URL: "https://grani-test.ru" };

test("works without any messenger configured", () => {
  expect(readWorkerEnv(BASE)).toEqual({ ...BASE, telegramToken: null, vkGroupToken: null, dryRun: false, poolMax: 3 });
});

test("reads tokens and the dry run switch", () => {
  expect(readWorkerEnv({ ...BASE, TELEGRAM_BOT_TOKEN: "123:abc", VK_GROUP_TOKEN: "vk1.a.token", NOTIFICATIONS_DRY_RUN: "1" })).toEqual({
    ...BASE,
    telegramToken: "123:abc",
    vkGroupToken: "vk1.a.token",
    dryRun: true,
    poolMax: 3,
  });
});

test("takes the pool size from DATABASE_POOL_MAX, like the site", () => {
  expect(readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "1" }).poolMax).toBe(1);
  expect(() => readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
});

test("names invalid variables without printing values", () => {
  const run = () => readWorkerEnv({ DATABASE_URL: "", APP_URL: "not a url", TELEGRAM_BOT_TOKEN: "secret-bad" });

  expect(run).toThrow(/DATABASE_URL/);
  expect(run).toThrow(/APP_URL/);
  expect(run).not.toThrow(/secret-bad/);
});
