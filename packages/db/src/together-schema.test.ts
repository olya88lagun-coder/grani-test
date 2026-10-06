import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { purchases, togetherAccessPeriods, togetherInvites, togetherMembers, togetherSpaces } from "./schema";
import { createTestDb, seedUser, seedUserWithResult } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const DAY_MS = 86_400_000;

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function newSpace(): Promise<string> {
  const [space] = await db.insert(togetherSpaces).values({ status: "pending" }).returning({ id: togetherSpaces.id });
  return space!.id;
}

const member = (spaceId: string, userId: string, role: "initiator" | "partner") => db.insert(togetherMembers).values({ spaceId, userId, role, joinedAt: NOW });

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
  boris = await seedUser(db, { externalId: "boris" });
  vera = await seedUser(db, { externalId: "vera" });
});

describe("together members", () => {
  test("a space cannot get a third member", async () => {
    const spaceId = await newSpace();
    await member(spaceId, anna, "initiator");
    await member(spaceId, boris, "partner");

    await expect(member(spaceId, vera, "partner")).rejects.toThrow();
    await expect(member(spaceId, vera, "initiator")).rejects.toThrow();
  });

  test("a user cannot be an active member of two spaces, but can join again after leaving", async () => {
    const first = await newSpace();
    await member(first, anna, "initiator");

    await expect(member(await newSpace(), anna, "initiator")).rejects.toThrow();

    await db.update(togetherMembers).set({ leftAt: NOW }).where(eq(togetherMembers.spaceId, first));
    await expect(member(await newSpace(), anna, "initiator")).resolves.toBeDefined();
  });
});

describe("together invites", () => {
  const invite = (spaceId: string, tokenHash: string, status: "open" | "requested" | "accepted" | "revoked") =>
    db.insert(togetherInvites).values({ spaceId, tokenHash, inviterId: anna, status, expiresAt: new Date(NOW.getTime() + DAY_MS) });

  test("a space has at most one live invite, but any number of finished ones", async () => {
    const spaceId = await newSpace();
    await invite(spaceId, "h1", "open");

    await expect(invite(spaceId, "h2", "requested")).rejects.toThrow();
    await expect(invite(spaceId, "h3", "revoked")).resolves.toBeDefined();
    await expect(invite(spaceId, "h4", "accepted")).resolves.toBeDefined();
  });

  test("token hashes are unique", async () => {
    await invite(await newSpace(), "same", "revoked");

    await expect(invite(await newSpace(), "same", "revoked")).rejects.toThrow();
  });
});

describe("together spaces", () => {
  test("closed status and closing time go together", async () => {
    const spaceId = await newSpace();

    await expect(db.update(togetherSpaces).set({ status: "closed" }).where(eq(togetherSpaces.id, spaceId))).rejects.toThrow();
    await expect(db.update(togetherSpaces).set({ closedAt: NOW }).where(eq(togetherSpaces.id, spaceId))).rejects.toThrow();
    await expect(db.update(togetherSpaces).set({ status: "closed", closedAt: NOW }).where(eq(togetherSpaces.id, spaceId))).resolves.toBeDefined();
  });
});

describe("purchases and access periods", () => {
  async function spacePurchase(spaceId: string) {
    const [row] = await db
      .insert(purchases)
      .values({ userId: anna, product: "together_30d", spaceId, amountKopecks: 39_900 })
      .returning({ id: purchases.id });
    return row!.id;
  }

  test("a purchase points at no more than one target", async () => {
    const spaceId = await newSpace();
    const { resultId } = await seedUserWithResult(db, { externalId: "with-result" });

    await expect(spacePurchase(spaceId)).resolves.toBeDefined();
    await expect(db.insert(purchases).values({ userId: anna, product: "together_30d", spaceId, resultId, amountKopecks: 1 })).rejects.toThrow();
  });

  test("one purchase cannot be turned into two access periods", async () => {
    const spaceId = await newSpace();
    const purchaseId = await spacePurchase(spaceId);
    const period = { spaceId, purchaseId, startsAt: NOW, endsAt: new Date(NOW.getTime() + 30 * DAY_MS) };
    await db.insert(togetherAccessPeriods).values(period);

    await expect(db.insert(togetherAccessPeriods).values(period)).rejects.toThrow();
  });

  test("a period must end after it starts", async () => {
    const spaceId = await newSpace();

    await expect(
      db.insert(togetherAccessPeriods).values({ spaceId, purchaseId: await spacePurchase(spaceId), startsAt: NOW, endsAt: NOW }),
    ).rejects.toThrow();
  });
});
