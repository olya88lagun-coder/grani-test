import { beforeEach, describe, expect, test } from "vitest";
import { fixtureCard } from "./together-cards.fixtures";
import { togetherAnswers, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, type Database } from "./testing";
import { countRevealedCards } from "./together-stats";

const CLOSED = new Date("2026-10-07T10:00:00Z");
const DATES = new Set(["m01-d07"]);

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;
let position = 0;

async function card(cardId: string, closedAt: Date | null): Promise<string> {
  position += 1;
  const [row] = await db.insert(togetherCards).values({ spaceId, cardId, position, snapshot: fixtureCard(cardId, "main"), closedAt }).returning({ id: togetherCards.id });
  return row!.id;
}

const answer = (cardUuid: string, userId: string, status: "submitted" | "skipped" = "submitted") =>
  db.insert(togetherAnswers).values({ cardId: cardUuid, spaceId, userId, status, fields: status === "submitted" ? { answer: "ответ" } : {} });

async function revealed(cardId: string) {
  const id = await card(cardId, CLOSED);
  await answer(id, anna);
  await answer(id, boris);
}

beforeEach(async () => {
  db = await createTestDb();
  position = 0;
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db));
});

describe("countRevealedCards", () => {
  test("is zero for a pair that has not played yet", async () => {
    expect(await countRevealedCards(db, { spaceId, dateCardIds: DATES })).toEqual({ conversations: 0, dates: 0 });
  });

  test("counts cards both partners answered, and tells dates from ordinary conversations", async () => {
    await revealed("intro-01");
    await revealed("m01-d01");
    await revealed("m01-d07");

    expect(await countRevealedCards(db, { spaceId, dateCardIds: DATES })).toEqual({ conversations: 2, dates: 1 });
  });

  test("does not count a card that was skipped, left open, or answered by one partner only", async () => {
    const skipped = await card("m01-d02", CLOSED);
    await answer(skipped, anna);
    await answer(skipped, boris, "skipped");
    const open = await card("m01-d03", null);
    await answer(open, anna);
    await answer(open, boris);
    const single = await card("m01-d04", CLOSED);
    await answer(single, anna);

    expect(await countRevealedCards(db, { spaceId, dateCardIds: DATES })).toEqual({ conversations: 0, dates: 0 });
  });

  test("counts only the given space", async () => {
    await revealed("m01-d01");
    const other = await seedTogetherSpace(db);

    expect(await countRevealedCards(db, { spaceId: other.spaceId, dateCardIds: DATES })).toEqual({ conversations: 0, dates: 0 });
  });
});
