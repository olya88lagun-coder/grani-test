import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { closeSpaceForUser, createSpace, requestJoin, respondToRequest } from "./together";
import { ensureShareCode } from "./together-share";
import { togetherSpaces } from "./schema";
import { createTestDb, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-07T10:00:00Z");

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function activeSpace(initiator: string, partner: string): Promise<string> {
  const created = await createSpace(db, { userId: initiator, now: NOW });
  if (!created.ok) throw new Error(created.reason);
  await requestJoin(db, { token: created.token, userId: partner, now: NOW });
  await respondToRequest(db, { userId: initiator, accept: true, now: NOW });
  return created.spaceId;
}

const referredBy = async (spaceId: string) => (await db.select({ value: togetherSpaces.referredBySpaceId }).from(togetherSpaces).where(eq(togetherSpaces.id, spaceId)))[0]?.value;

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("ensureShareCode", () => {
  test("both members of an active space get the same stable code", async () => {
    await activeSpace(anna, boris);

    const first = await ensureShareCode(db, { userId: anna });

    expect(first).toMatch(/^[a-z2-9]{10}$/);
    expect(await ensureShareCode(db, { userId: anna })).toBe(first);
    expect(await ensureShareCode(db, { userId: boris })).toBe(first);
  });

  test("a person without a space, or in a space still waiting for the partner, gets no code", async () => {
    expect(await ensureShareCode(db, { userId: vera })).toBeNull();
    await createSpace(db, { userId: vera, now: NOW });

    expect(await ensureShareCode(db, { userId: vera })).toBeNull();
  });
});

describe("referral attribution", () => {
  test("a new space made by a share code remembers the space it came from", async () => {
    const source = await activeSpace(anna, boris);
    const code = (await ensureShareCode(db, { userId: anna }))!;

    const created = await createSpace(db, { userId: vera, now: NOW, referredByCode: code });

    expect(created.ok && (await referredBy(created.spaceId))).toBe(source);
  });

  test("an unknown code, a wrong format and a missing code leave no trace and do not stop the creation", async () => {
    await activeSpace(anna, boris);

    for (const referredByCode of ["abcdefghij", "bad", "", undefined]) {
      const created = await createSpace(db, { userId: vera, now: NOW, referredByCode });
      expect(created.ok).toBe(true);
      expect(created.ok && (await referredBy(created.spaceId))).toBeNull();
      if (created.ok) await db.delete(togetherSpaces).where(eq(togetherSpaces.id, created.spaceId));
    }
  });

  test("a person who was in the source pair gets no attribution from their own pair's code", async () => {
    await activeSpace(anna, boris);
    const code = (await ensureShareCode(db, { userId: anna }))!;
    await closeSpaceForUser(db, { userId: boris, now: NOW, reason: "left" });

    const created = await createSpace(db, { userId: boris, now: NOW, referredByCode: code });

    expect(created.ok && (await referredBy(created.spaceId))).toBeNull();
  });
});
