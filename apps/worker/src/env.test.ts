import { expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const BASE = { DATABASE_URL: "postgres://u:p@db/grani", APP_URL: "https://grani-test.ru" };

test("works without the VK community configured", () => {
  expect(readWorkerEnv(BASE)).toEqual({ ...BASE, vkGroupToken: null, dryRun: false, poolMax: 3, ai: { provider: "none" }, chapterCardsV2: false, lifeCardsV1: false, portraitV1: false });
});

test("reads the VK token and the dry run switch, and ignores a Telegram token", () => {
  expect(readWorkerEnv({ ...BASE, TELEGRAM_BOT_TOKEN: "123:abc", VK_GROUP_TOKEN: "vk1.a.token", NOTIFICATIONS_DRY_RUN: "1" })).toEqual({
    ...BASE,
    vkGroupToken: "vk1.a.token",
    dryRun: true,
    poolMax: 3,
    ai: { provider: "none" },
    chapterCardsV2: false,
    lifeCardsV1: false,
    portraitV1: false,
  });
});

test("the chapter cards pilot is off unless CHAPTER_CARDS_V2 is 1", () => {
  expect(readWorkerEnv(BASE).chapterCardsV2).toBe(false);
  expect(readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "0" }).chapterCardsV2).toBe(false);
  expect(readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "1" }).chapterCardsV2).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, CHAPTER_CARDS_V2: "yes" })).toThrow(/CHAPTER_CARDS_V2/);
});

test("takes the pool size from DATABASE_POOL_MAX, like the site", () => {
  expect(readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "1" }).poolMax).toBe(1);
  expect(() => readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
});

test("names invalid variables without printing values", () => {
  const run = () => readWorkerEnv({ DATABASE_URL: "", APP_URL: "not a url", AI_PROVIDER: "secret-bad" });

  expect(run).toThrow(/DATABASE_URL/);
  expect(run).toThrow(/APP_URL/);
  expect(run).not.toThrow(/secret-bad/);
});

test("reads the AI provider with its keys", () => {
  expect(readWorkerEnv({ ...BASE, AI_PROVIDER: "yandex", YANDEX_API_KEY: "key", YANDEX_FOLDER_ID: "b1g" }).ai).toEqual({ provider: "yandex", apiKey: "key", folderId: "b1g" });
  expect(readWorkerEnv({ ...BASE, AI_PROVIDER: "gigachat", GIGACHAT_AUTH_KEY: "auth" }).ai).toEqual({ provider: "gigachat", authKey: "auth", scope: "GIGACHAT_API_PERS" });
  expect(() => readWorkerEnv({ ...BASE, AI_PROVIDER: "yandex", YANDEX_API_KEY: "key" })).toThrow(/YANDEX_FOLDER_ID/);
  expect(() => readWorkerEnv({ ...BASE, AI_PROVIDER: "gigachat" })).toThrow(/GIGACHAT_AUTH_KEY/);
});

test("the life cards are off unless LIFE_CARDS_V1 is 1", () => {
  expect(readWorkerEnv(BASE).lifeCardsV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "0" }).lifeCardsV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "1" }).lifeCardsV1).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, LIFE_CARDS_V1: "yes" })).toThrow(/LIFE_CARDS_V1/);
});

test("the portrait blocks are off unless PORTRAIT_V1 is 1", () => {
  expect(readWorkerEnv(BASE).portraitV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, PORTRAIT_V1: "0" }).portraitV1).toBe(false);
  expect(readWorkerEnv({ ...BASE, PORTRAIT_V1: "1" }).portraitV1).toBe(true);
  expect(() => readWorkerEnv({ ...BASE, PORTRAIT_V1: "yes" })).toThrow(/PORTRAIT_V1/);
});
