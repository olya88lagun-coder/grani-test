import { createTestDb, purgeExpiredData, upsertUserFromIdentity, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runRetention } from "./retention";

const NOW = new Date("2026-10-07T03:00:00Z");
const OLD = new Date("2022-01-01T00:00:00Z");

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

async function seedInactive(count: number) {
  for (let i = 0; i < count; i += 1) {
    // Человек, который зарегистрировался и входил в последний раз давно
    await upsertUserFromIdentity(db, { provider: "telegram", externalId: `old-${i}`, displayName: "Старый", gender: null }, { version: "test", at: OLD }, OLD);
  }
}

describe("runRetention", () => {
  test("keeps going batch after batch until nothing is left to erase", async () => {
    await seedInactive(5);
    const log = vi.fn();

    const total = await runRetention({ db, log, now: NOW, batchSize: 2 });

    expect(total).toMatchObject({ usersDeleted: 5, purchasesDeleted: 0 });
    expect((await purgeExpiredData(db, { now: NOW })).usersDeleted).toBe(0);
    expect(log).toHaveBeenCalledWith("info", "retention finished", expect.objectContaining({ usersDeleted: 5 }));
  });

  test("logs nothing personal and stays quiet at warn level when all went well", async () => {
    await seedInactive(1);
    const log = vi.fn();

    await runRetention({ db, log, now: NOW });

    expect(log.mock.calls.filter(([level]) => level !== "info")).toEqual([]);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/old-0/);
  });

  test("fails loudly when someone could not be erased, so the job is visible as failed", async () => {
    await seedInactive(1);
    const log = vi.fn();
    const broken = Object.assign(Object.create(db), { transaction: () => Promise.reject(new Error("db is down")) }) as Database;

    await expect(runRetention({ db: broken, log, now: NOW })).rejects.toThrow(/could not be erased/);
    expect(log).toHaveBeenCalledWith("warn", "retention could not erase some accounts", expect.objectContaining({ failed: 1 }));
  });
});
