import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, getUser, upsertUserFromIdentity, type Database, type IdentityInput } from "./testing";

const CONSENT = { version: "2026-09-v1", at: new Date("2026-09-17T10:00:00Z") };

function identity(overrides: Partial<IdentityInput> = {}): IdentityInput {
  return { provider: "telegram", externalId: "1001", displayName: "Аня", gender: null, ...overrides };
}

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("upsertUserFromIdentity", () => {
  test("refuses to create a user without consent", async () => {
    const outcome = await upsertUserFromIdentity(db, identity(), null);

    expect(outcome).toEqual({ ok: false, reason: "CONSENT_REQUIRED" });
  });

  test("creates a user with consent and returns the display name", async () => {
    const outcome = await upsertUserFromIdentity(db, identity({ gender: "female" }), CONSENT);

    expect(outcome.ok && outcome.created).toBe(true);
    expect(outcome.ok && outcome.user).toMatchObject({ displayName: "Аня", gender: "female" });
  });

  test("finds the existing user on the next login even without a new consent", async () => {
    const first = await upsertUserFromIdentity(db, identity(), CONSENT);

    const second = await upsertUserFromIdentity(db, identity({ displayName: "Анна" }), null);

    expect(second.ok && second.created).toBe(false);
    expect(second.ok && second.user.id).toBe(first.ok && first.user.id);
    expect(second.ok && second.user.displayName).toBe("Анна");
  });

  test("fills a missing gender but never overwrites a known one", async () => {
    const created = await upsertUserFromIdentity(db, identity(), CONSENT);
    const userId = created.ok ? created.user.id : "";

    await upsertUserFromIdentity(db, identity({ gender: "female" }), null);
    await upsertUserFromIdentity(db, identity({ gender: "male" }), null);

    expect((await getUser(db, userId))?.gender).toBe("female");
  });

  test("treats the same external id from another provider as another user", async () => {
    const telegram = await upsertUserFromIdentity(db, identity(), CONSENT);

    const vk = await upsertUserFromIdentity(db, identity({ provider: "vk" }), CONSENT);

    expect(vk.ok && vk.user.id).not.toBe(telegram.ok && telegram.user.id);
  });
});

describe("getUser", () => {
  test("returns null for an unknown or malformed id", async () => {
    expect(await getUser(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getUser(db, "not-a-uuid")).toBeNull();
  });
});
