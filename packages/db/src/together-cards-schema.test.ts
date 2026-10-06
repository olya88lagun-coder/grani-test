import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SNAPSHOT: CardSnapshot = {
  id: "c1",
  version: 1,
  kind: "intro",
  title: "T",
  estimatedMinutes: 5,
  prompt: "P",
  hint: "H",
  jointAction: "J",
  skipAllowed: true,
  fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
};

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const card = (space: string, position: number, closedAt: Date | null = null, cardId = `c${position}`) =>
  db.insert(togetherCards).values({ spaceId: space, cardId, position, snapshot: { ...SNAPSHOT, id: cardId }, closedAt }).returning({ id: togetherCards.id });

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("together cards", () => {
  test("a space has at most one open card, and a closed one makes room for the next", async () => {
    const [first] = await card(spaceId, 1);
    await expect(card(spaceId, 2)).rejects.toThrow();

    await db.update(togetherCards).set({ closedAt: NOW }).where(eq(togetherCards.id, first!.id));
    await expect(card(spaceId, 2)).resolves.toBeDefined();
  });

  test("positions and catalog ids are unique inside a space but not across spaces", async () => {
    const other = await seedTogetherSpace(db, { now: NOW });
    await card(spaceId, 1, NOW);

    await expect(card(spaceId, 1, NOW, "other-id")).rejects.toThrow();
    await expect(card(spaceId, 2, NOW, "c1")).rejects.toThrow();
    await expect(card(other.spaceId, 1)).resolves.toBeDefined();
    await expect(card(spaceId, 0, NOW, "zero")).rejects.toThrow();
  });
});

describe("together answers", () => {
  const answer = (cardRowId: string, space: string, userId: string, values: Partial<typeof togetherAnswers.$inferInsert> = {}) =>
    db.insert(togetherAnswers).values({ cardId: cardRowId, spaceId: space, userId, status: "submitted", fields: { answer: "text" }, ...values });

  test("one answer per person and card", async () => {
    const [row] = await card(spaceId, 1);
    await answer(row!.id, spaceId, anna);

    await expect(answer(row!.id, spaceId, anna)).rejects.toThrow();
    await expect(answer(row!.id, spaceId, boris)).resolves.toBeDefined();
  });

  test("an answer needs an author who belongs to the same space", async () => {
    const [row] = await card(spaceId, 1);
    const vera = await seedUser(db, { externalId: "vera" });
    const other = await seedTogetherSpace(db, { now: NOW });

    await expect(answer(row!.id, spaceId, vera)).rejects.toThrow();
    await expect(answer(row!.id, spaceId, other.initiatorId)).rejects.toThrow();
  });

  test("an answer cannot point at a card of another space", async () => {
    const other = await seedTogetherSpace(db, { now: NOW });
    const [row] = await card(spaceId, 1);

    await expect(answer(row!.id, other.spaceId, other.initiatorId)).rejects.toThrow();
  });

  test("a skipped answer is empty and the revision starts at one", async () => {
    const [row] = await card(spaceId, 1);

    await expect(answer(row!.id, spaceId, anna, { status: "skipped", fields: { answer: "leftover" } })).rejects.toThrow();
    await expect(answer(row!.id, spaceId, anna, { revision: 0 })).rejects.toThrow();
    await expect(answer(row!.id, spaceId, anna, { status: "skipped", fields: {} })).resolves.toBeDefined();
  });
});

describe("together card marks", () => {
  test("one mark per person and card, and only for members of the space", async () => {
    const [row] = await card(spaceId, 1, NOW);
    const vera = await seedUser(db, { externalId: "vera" });
    const mark = (userId: string) => db.insert(togetherCardMarks).values({ cardId: row!.id, spaceId, userId, seenAt: NOW });

    await mark(anna);
    await expect(mark(anna)).rejects.toThrow();
    await expect(mark(vera)).rejects.toThrow();
  });
});
