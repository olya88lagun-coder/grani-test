import { createTestDb, getUser, seedUserWithResult, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount } from "./account-service";
import { signSession } from "./auth/tokens";
import type { AppEnv } from "./env";

const ENV: AppEnv = {
  APP_URL: "https://grani-test.ru",
  DATABASE_URL: "postgres://unused",
  SESSION_SECRET: "s".repeat(40),
  TELEGRAM_BOT_TOKEN: "123456:TEST-TOKEN",
  TELEGRAM_BOT_USERNAME: "test_grani_bot",
  VK_CLIENT_ID: "555",
  vkCommunity: null,
  payments: null,
};

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("deleteAccount", () => {
  it("deletes the signed-in user's data and the session stops working", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-1" });
    const sessionToken = await signSession(userId, ENV.SESSION_SECRET);

    const outcome = await deleteAccount({ db, env: ENV }, { sessionToken });

    expect(outcome).toEqual({ ok: true });
    expect(await getUser(db, userId)).toBeNull();
    expect(await deleteAccount({ db, env: ENV }, { sessionToken })).toEqual({ ok: false, error: "unauthorized" });
  });

  it("refuses without a valid session and deletes nothing", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-2" });

    expect(await deleteAccount({ db, env: ENV }, { sessionToken: null })).toEqual({ ok: false, error: "unauthorized" });
    expect(await deleteAccount({ db, env: ENV }, { sessionToken: "forged" })).toEqual({ ok: false, error: "unauthorized" });
    expect(await getUser(db, userId)).not.toBeNull();
  });
});
