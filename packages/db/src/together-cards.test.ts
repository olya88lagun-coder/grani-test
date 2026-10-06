import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherSpace, seedUser } from "./testing";
import { closeSpaceForUser, createSpace } from "./together";
import { loadCurrentCard } from "./together-cards";
import { FIXTURE_TRACK } from "./together-cards.fixtures";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SECRET = "СЕКРЕТ-ПАРТНЁРА";

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const current = (userId: string, track = FIXTURE_TRACK) => loadCurrentCard(db, { userId, track, now: NOW });

async function firstCardId(): Promise<string> {
  const result = await current(anna);
  if (!result.ok || !result.card) throw new Error("no current card");
  return result.card.id;
}

const answer = (cardId: string, userId: string, status: "submitted" | "skipped", fields: Record<string, string | boolean> = {}, revision = 1) =>
  db.insert(togetherAnswers).values({ cardId, spaceId, userId, status, fields, revision });
const close = (cardId: string) => db.update(togetherCards).set({ closedAt: NOW }).where(eq(togetherCards.id, cardId));
const mark = (cardId: string, userId: string) => db.insert(togetherCardMarks).values({ cardId, spaceId, userId, seenAt: NOW });

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("loadCurrentCard", () => {
  test("issues the first card once and shows the same card to both", async () => {
    const first = await current(anna);
    await current(boris);
    await current(anna);

    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(1);
    expect(first).toMatchObject({
      ok: true,
      progress: { done: 0, total: 3 },
      accessActive: false,
      card: { position: 1, state: "answer", mine: null, partner: { status: "none" }, snapshot: { id: "intro-01" } },
    });
  });

  test("shows nothing outside an active space", async () => {
    const vera = await seedUser(db, { externalId: "vera" });
    expect(await current(vera)).toEqual({ ok: false, reason: "not_found" });

    const pending = await seedUser(db, { externalId: "pending" });
    await createSpace(db, { userId: pending, now: NOW });
    expect(await current(pending)).toEqual({ ok: false, reason: "not_found" });

    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });
    expect(await current(anna)).toEqual({ ok: false, reason: "not_found" });
    expect(await current(boris)).toEqual({ ok: false, reason: "not_found" });
  });

  test("never exposes a partner answer before the reveal", async () => {
    const cardId = await firstCardId();
    await answer(cardId, boris, "submitted", { answer: SECRET });

    const waitingForMe = await current(anna);
    expect(waitingForMe).toMatchObject({ card: { state: "answer", partner: { status: "answered" } } });
    expect(JSON.stringify(waitingForMe)).not.toContain(SECRET);

    // Анна пропустила, карточка закрыта: ответ Бориса ей всё равно не раскрывается
    await answer(cardId, anna, "skipped");
    await close(cardId);
    const afterSkip = await current(anna);
    expect(afterSkip).toMatchObject({ card: { position: 1, state: "skipped", mine: null, partner: { status: "answered" } } });
    expect(JSON.stringify(afterSkip)).not.toContain(SECRET);
    expect(await current(boris)).toMatchObject({ card: { state: "skipped", mine: { fields: { answer: SECRET } }, partner: { status: "skipped" } } });
  });

  test("reveals both answers when both are submitted and flags an edited partner answer", async () => {
    const cardId = await firstCardId();
    await answer(cardId, anna, "submitted", { answer: "Мой ответ" });
    await answer(cardId, boris, "submitted", { answer: SECRET }, 2);
    await close(cardId);
    await db.insert(togetherCardMarks).values({ cardId, spaceId, userId: boris, seenAt: NOW, doneAt: NOW });

    expect(await current(anna)).toMatchObject({
      card: { state: "revealed", mine: { fields: { answer: "Мой ответ" }, revision: 1, done: false }, partner: { status: "answered", fields: { answer: SECRET }, edited: true, done: true } },
    });
  });

  test("puts an unseen result before the open card until the person has seen it", async () => {
    const cardId = await firstCardId();
    await answer(cardId, anna, "submitted", { answer: "a" });
    await answer(cardId, boris, "submitted", { answer: "b" });
    await close(cardId);

    expect(await current(anna)).toMatchObject({ card: { position: 1, state: "revealed" }, progress: { done: 1, total: 3 } });
    await mark(cardId, anna);
    expect(await current(anna)).toMatchObject({ card: { position: 2, state: "answer", snapshot: { id: "intro-02" } } });
    expect(await current(boris)).toMatchObject({ card: { position: 1, state: "revealed" } });
    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(2);
  });

  test("returns no card once the track is finished and every result is seen", async () => {
    const shortTrack = FIXTURE_TRACK.slice(0, 1);
    const cardId = (await current(anna, shortTrack).then((result) => (result.ok ? result.card?.id : undefined)))!;
    await answer(cardId, anna, "submitted", { answer: "a" });
    await answer(cardId, boris, "submitted", { answer: "b" });
    await close(cardId);

    expect(await current(anna, shortTrack)).toMatchObject({ card: { state: "revealed" } });
    await mark(cardId, anna);
    await mark(cardId, boris);

    expect(await current(anna, shortTrack)).toEqual({ ok: true, card: null, progress: { done: 1, total: 1 }, accessActive: false });
    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(1);
  });
});
