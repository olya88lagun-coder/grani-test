import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherAccess, seedTogetherSpace, seedUser } from "./testing";
import { closeSpaceForUser, createSpace } from "./together";
import { listHistory, loadCurrentCard } from "./together-cards";
import { fixtureCard, FIXTURE_TRACK, UNLOCK_TRACK } from "./together-cards.fixtures";
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

    expect(await current(anna, shortTrack)).toEqual({ ok: true, card: null, progress: { done: 1, total: 1 }, accessActive: false, lock: null });
    expect(await db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId))).toHaveLength(1);
  });
});

describe("listHistory", () => {
  async function playTwoCards() {
    const first = await firstCardId();
    await answer(first, anna, "submitted", { answer: "Аня-1" });
    await answer(first, boris, "submitted", { answer: "Борис-1" });
    await close(first);
    await mark(first, anna);
    await current(anna);
    const second = (await db.select().from(togetherCards).where(eq(togetherCards.position, 2)))[0]!;
    await answer(second.id, anna, "skipped");
    await answer(second.id, boris, "submitted", { answer: SECRET });
    await close(second.id);
    return { first, second: second.id };
  }

  test("lists closed cards newest first with both answers only for revealed ones", async () => {
    const { first, second } = await playTwoCards();

    const result = await listHistory(db, { userId: anna });
    if (!result.ok) throw new Error("no space");
    expect(result.items.map((item) => [item.id, item.outcome])).toEqual([
      [second, "skipped"],
      [first, "revealed"],
    ]);
    expect(result.items[1]).toMatchObject({ mine: { fields: { answer: "Аня-1" } }, partner: { status: "answered", fields: { answer: "Борис-1" } } });
    expect(result.items[0]).toMatchObject({ mine: null, partner: { status: "answered" } });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result.next).toBeNull();
  });

  test("pages by position and refuses outsiders and closed spaces", async () => {
    await playTwoCards();

    const page = await listHistory(db, { userId: boris, limit: 1 });
    if (!page.ok) throw new Error("no space");
    expect(page.items.map((item) => item.position)).toEqual([2]);
    expect(page.next).toBe(2);
    const rest = await listHistory(db, { userId: boris, before: 2, limit: 1 });
    if (!rest.ok) throw new Error("no space");
    expect(rest.items.map((item) => item.position)).toEqual([1]);
    expect(rest.next).toBeNull();

    const vera = await seedUser(db, { externalId: "vera" });
    expect(await listHistory(db, { userId: vera })).toEqual({ ok: false, reason: "not_found" });
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });
    expect(await listHistory(db, { userId: boris })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("lock of the current card", () => {
  const DAY_MS = 86_400_000;
  const at = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

  async function lockAt(days: number) {
    const result = await loadCurrentCard(db, { userId: anna, track: UNLOCK_TRACK, now: at(days) });
    if (!result.ok) throw new Error("no space");
    return result;
  }

  async function playTo(cardIndex: number, days: number) {
    for (let i = 0; i < cardIndex; i++) {
      const current = await lockAt(days);
      const cardId = current.card!.id;
      await answer(cardId, anna, "submitted", { answer: "a" });
      await answer(cardId, boris, "submitted", { answer: "b" });
      await close(cardId);
      await mark(cardId, anna);
      await mark(cardId, boris);
    }
  }

  test("is a payment lock for a paid card without access, and none for a free card", async () => {
    expect((await lockAt(0)).lock).toBeNull();
    await playTo(1, 0);

    expect((await lockAt(0)).lock).toEqual({ kind: "payment" });
  });

  test("is a month lock with the opening moment while access is active but paid time is short", async () => {
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: at(2) });
    await playTo(2, 1);

    const result = await lockAt(5);
    expect(result.lock).toEqual({ kind: "month", month: 2, opensAt: at(30) });
    expect((await lockAt(31)).lock).toBeNull();
  });

  test("says the month opens after a renewal when the paid periods cannot reach it yet", async () => {
    const track = [fixtureCard("intro-01"), fixtureCard("main-01", "main"), fixtureCard("month3-01", "main", true, 2)];
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    for (let i = 0; i < 2; i++) {
      const current = await loadCurrentCard(db, { userId: anna, track, now: at(1) });
      const cardId = (current.ok ? current.card?.id : undefined)!;
      await answer(cardId, anna, "submitted", { answer: "a" });
      await answer(cardId, boris, "submitted", { answer: "b" });
      await close(cardId);
      await mark(cardId, anna);
      await mark(cardId, boris);
    }

    const result = await loadCurrentCard(db, { userId: anna, track, now: at(5) });
    expect(result.ok && result.lock).toEqual({ kind: "month", month: 3, opensAt: null });
  });
});
