import { beforeEach, describe, expect, test } from "vitest";
import { hasTogetherConsent, recordTogetherConsent } from "./together-consent";
import { createTestDb, seedUser } from "./testing";
import type { Database } from "./types";

const AT = new Date("2026-10-07T10:00:00Z");

let db: Database;
let anna: string;

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
});

describe("together consent", () => {
  test("a new user has not agreed, and a recorded agreement is for that version only", async () => {
    expect(await hasTogetherConsent(db, anna, "2026-10-v2")).toBe(false);

    await recordTogetherConsent(db, { userId: anna, version: "2026-10-v2", at: AT });

    expect(await hasTogetherConsent(db, anna, "2026-10-v2")).toBe(true);
    expect(await hasTogetherConsent(db, anna, "2026-11-v1")).toBe(false);
  });

  test("agreeing again to a newer version replaces the record", async () => {
    await recordTogetherConsent(db, { userId: anna, version: "2026-10-v2", at: AT });
    await recordTogetherConsent(db, { userId: anna, version: "2026-11-v1", at: new Date(AT.getTime() + 1000) });

    expect(await hasTogetherConsent(db, anna, "2026-11-v1")).toBe(true);
    expect(await hasTogetherConsent(db, anna, "2026-10-v2")).toBe(false);
  });

  test("an unknown or malformed user id has not agreed", async () => {
    expect(await hasTogetherConsent(db, "0b6f1f0e-5a7e-4c1e-9d2a-3f1b2c3d4e5f", "2026-10-v2")).toBe(false);
    expect(await hasTogetherConsent(db, "not-a-uuid", "2026-10-v2")).toBe(false);
  });
});
