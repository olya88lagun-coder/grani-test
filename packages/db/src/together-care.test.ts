import { beforeEach, describe, expect, test } from "vitest";
import { fixtureCard } from "./together-cards.fixtures";
import { togetherAnswers, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, seedUser, type Database } from "./testing";
import { createSpace } from "./together";
import { loadCareSources } from "./together-care";

const CLOSED = new Date("2026-10-07T10:00:00Z");
const SOURCES = ["m01-d14", "m01-d15"];

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

const answer = (cardUuid: string, userId: string, fields: Record<string, string | boolean>, status: "submitted" | "skipped" = "submitted") =>
  db.insert(togetherAnswers).values({ cardId: cardUuid, spaceId, userId, status, fields });

beforeEach(async () => {
  db = await createTestDb();
  position = 0;
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db));
});

describe("loadCareSources", () => {
  test("a person outside a space, or in a space still waiting for the partner, gets nothing", async () => {
    const vera = await seedUser(db, { externalId: "vera" });
    const waiting = await seedUser(db, { externalId: "gleb" });
    await createSpace(db, { userId: waiting, now: CLOSED });

    expect(await loadCareSources(db, { userId: vera, sourceIds: SOURCES, readyCardId: "m01-d26" })).toBeNull();
    expect(await loadCareSources(db, { userId: waiting, sourceIds: SOURCES, readyCardId: "m01-d26" })).toBeNull();
  });

  test("returns both members and is not ready until the month card is closed", async () => {
    const result = await loadCareSources(db, { userId: anna, sourceIds: SOURCES, readyCardId: "m01-d26" });

    expect(result).toMatchObject({ ready: false, answers: [] });
    expect(result!.members.map((member) => member.displayName).sort()).toEqual(["Аня", "Борис"]);
    expect(result!.members.map((member) => member.userId).sort()).toEqual([anna, boris].sort());
  });

  test("reads the submitted answers of closed source cards only", async () => {
    const closed = await card("m01-d14", CLOSED);
    const open = await card("m01-d15", null);
    await card("m01-d26", CLOSED);
    await answer(closed, anna, { answer: "а", care_action: "Спросить", allow_care_reward: true });
    await answer(closed, boris, {}, "skipped");
    await answer(open, anna, { answer: "ещё не раскрыто", care_action: "Рано" });

    const result = await loadCareSources(db, { userId: boris, sourceIds: SOURCES, readyCardId: "m01-d26" });

    expect(result!.ready).toBe(true);
    expect(result!.answers).toEqual([{ cardId: "m01-d14", userId: anna, fields: { answer: "а", care_action: "Спросить", allow_care_reward: true } }]);
  });

  test("ignores cards that are not sources", async () => {
    const other = await card("m01-d03", CLOSED);
    await answer(other, anna, { answer: "не источник", care_action: "Лишнее", allow_care_reward: true });

    const result = await loadCareSources(db, { userId: anna, sourceIds: SOURCES, readyCardId: "m01-d26" });

    expect(result!.answers).toEqual([]);
  });
});
