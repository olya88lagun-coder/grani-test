import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
import { createTestDb, seedTogetherAccess, seedTogetherSpace, seedUser } from "./testing";
import { closeSpaceForUser } from "./together";
import { continueCard, deleteDraft, skipCard, submitAnswer } from "./together-card-actions";
import { loadCurrentCard } from "./together-cards";
import { fixtureCard, FIXTURE_TRACK, UNLOCK_TRACK } from "./together-cards.fixtures";
import type { Database } from "./types";

const NOW = new Date("2026-10-05T10:00:00Z");
const SECRET = "СЕКРЕТ-ПАРТНЁРА";

let db: Database;
let spaceId: string;
let anna: string;
let boris: string;

const put = (userId: string, cardId: string, fields: unknown, track: readonly CardSnapshot[] = FIXTURE_TRACK) => submitAnswer(db, { userId, cardId, fields, track, now: NOW });
const skip = (userId: string, cardId: string, track: readonly CardSnapshot[] = FIXTURE_TRACK) => skipCard(db, { userId, cardId, track, now: NOW });
const proceed = (userId: string, cardId: string, done = false) => continueCard(db, { userId, cardId, done, now: NOW });

async function viewOf(userId: string, track: readonly CardSnapshot[] = FIXTURE_TRACK) {
  const result = await loadCurrentCard(db, { userId, track, now: NOW });
  if (!result.ok) throw new Error("no space");
  return result;
}

async function currentId(userId = anna): Promise<string> {
  const { card } = await viewOf(userId);
  if (!card) throw new Error("no current card");
  return card.id;
}

async function reveal(cardId: string) {
  await put(anna, cardId, { answer: "ответ Ани" });
  await put(boris, cardId, { answer: "ответ Бориса" });
}

const answerRowOf = (cardId: string) => db.select().from(togetherAnswers).where(eq(togetherAnswers.cardId, cardId));
const cardRows = () => db.select().from(togetherCards).where(eq(togetherCards.spaceId, spaceId));
const answerRow = (cardId: string, userId: string) => db.select().from(togetherAnswers).where(and(eq(togetherAnswers.cardId, cardId), eq(togetherAnswers.userId, userId)));

beforeEach(async () => {
  db = await createTestDb();
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: NOW }));
});

describe("submitAnswer", () => {
  test("an answer waits for the partner and both are revealed only after the second one", async () => {
    const id = await currentId();

    expect(await put(anna, id, { answer: "Мой тихий вечер" })).toEqual({ ok: true, state: "waiting", revealed: null });
    const before = await viewOf(boris);
    expect(before.card?.partner).toEqual({ status: "answered" });
    expect(JSON.stringify(before)).not.toContain("Мой тихий вечер");

    const second = await put(boris, id, { answer: "Чай и тишина" });
    if (!second.ok || !second.revealed) throw new Error("expected a reveal");
    expect(second.state).toBe("revealed");
    expect(second.revealed.mine?.fields).toEqual({ answer: "Чай и тишина" });
    expect(second.revealed.partner.fields).toEqual({ answer: "Мой тихий вечер" });
    expect(await cardRows()).toHaveLength(2);
    expect((await viewOf(anna)).card).toMatchObject({ position: 1, state: "revealed" });
  });

  test("a repeated answer before the reveal replaces the text and keeps revision one", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "первый" });

    expect(await put(anna, id, { answer: "второй" })).toMatchObject({ ok: true, state: "waiting" });

    expect(await answerRow(id, anna)).toMatchObject([{ fields: { answer: "второй" }, revision: 1 }]);
  });

  test("rejects invalid input and after-reveal fields before the reveal", async () => {
    const id = await currentId();

    expect(await put(anna, id, { answer: "" })).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(await put(anna, id, { answer: "я".repeat(51) })).toEqual({ ok: false, reason: "invalid_field", field: "answer" });
    expect(await put(anna, id, { answer: "ок", unknown: 1 })).toEqual({ ok: false, reason: "invalid_field", field: "unknown" });
    expect(await put(anna, id, { answer: "ок", share_in_book: false })).toEqual({ ok: false, reason: "field_not_available", field: "share_in_book" });
    expect(await answerRow(id, anna)).toEqual([]);
  });

  test("the next card waits for the result to be seen, then opens", async () => {
    const first = await currentId();
    await reveal(first);

    expect(await put(anna, (await cardRows()).find((card) => card.position === 2)!.id, { answer: "рано" })).toEqual({ ok: false, reason: "reveal_pending" });
    await proceed(anna, first);

    const second = await currentId(anna);
    expect(await put(anna, second, { answer: "теперь можно" })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("an author edits the revealed answer: revision grows only on a real change and the partner sees the flag", async () => {
    const id = await currentId();
    await reveal(id);

    expect(await put(anna, id, { answer: "ответ Ани" })).toEqual({ ok: true, state: "edited", revealed: null });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 1 }]);
    expect(await put(anna, id, { answer: "исправленный", share_in_book: true })).toEqual({ ok: true, state: "edited", revealed: null });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 2, fields: { answer: "исправленный", share_in_book: true } }]);

    expect((await viewOf(boris)).card?.partner).toMatchObject({ edited: true, fields: { answer: "исправленный" } });
  });

  test("ticking a boolean after the reveal does not mark the text as edited, a text change does", async () => {
    const id = await currentId();
    await reveal(id);

    expect(await put(anna, id, { answer: "ответ Ани", share_in_book: true })).toEqual({ ok: true, state: "edited", revealed: null });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 1, fields: { answer: "ответ Ани", share_in_book: true } }]);
    expect((await viewOf(boris)).card?.partner).toMatchObject({ edited: false });

    await put(anna, id, { answer: "новый текст", share_in_book: true });
    expect(await answerRow(id, anna)).toMatchObject([{ revision: 2 }]);
    expect((await viewOf(boris)).card?.partner).toMatchObject({ edited: true });
  });

  test("a repeated submit after the reveal never creates a second next card", async () => {
    const id = await currentId();
    await reveal(id);

    await put(boris, id, { answer: "ответ Бориса" });
    await put(boris, id, { answer: "ответ Бориса" });

    expect(await cardRows()).toHaveLength(2);
  });

  test("cannot edit a card that was closed by a skip", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "мой" });
    await skip(boris, id);

    expect(await put(anna, id, { answer: "поздно" })).toEqual({ ok: false, reason: "already_closed" });
  });

  test("a main card needs access for the first answer only, an intro card never does", async () => {
    for (let i = 0; i < 2; i++) {
      const introId = await currentId();
      await reveal(introId);
      await proceed(anna, introId);
      await proceed(boris, introId);
    }
    const mainId = await currentId();

    expect(await put(anna, mainId, { answer: "платная" })).toEqual({ ok: false, reason: "access_required" });
    expect((await viewOf(anna)).accessActive).toBe(false);

    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    expect(await put(anna, mainId, { answer: "платная" })).toMatchObject({ ok: true, state: "waiting" });
    expect(await put(boris, mainId, { answer: "платная Бориса" })).toMatchObject({ ok: true, state: "revealed" });
  });

  test("answers of someone outside the space or to a malformed id are not found", async () => {
    const id = await currentId();
    const vera = await seedUser(db, { externalId: "vera" });
    const other = await seedTogetherSpace(db, { now: NOW });

    expect(await put(vera, id, { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
    expect(await put(other.initiatorId, id, { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
    expect(await put(anna, "not-a-uuid", { answer: "a" })).toEqual({ ok: false, reason: "not_found" });
  });

  test("a closed space refuses everything and keeps the data", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "осталось" });
    await closeSpaceForUser(db, { userId: boris, now: NOW, reason: "left" });

    expect(await put(anna, id, { answer: "ещё" })).toEqual({ ok: false, reason: "not_found" });
    expect(await skip(anna, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: false, reason: "not_found" });
    expect(await proceed(anna, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await answerRow(id, anna)).toMatchObject([{ fields: { answer: "осталось" } }]);
  });
});

describe("deleteDraft", () => {
  test("removes an unrevealed answer, is idempotent and keeps the card open", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "черновик" });

    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await answerRow(id, anna)).toEqual([]);
    expect(await put(boris, id, { answer: "Борис" })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("a revealed answer cannot be deleted, a skipped card is closed", async () => {
    const id = await currentId();
    await reveal(id);
    expect(await deleteDraft(db, { userId: anna, cardId: id })).toEqual({ ok: false, reason: "already_revealed" });

    await proceed(anna, id);
    const next = await currentId();
    await skip(anna, next);
    expect(await deleteDraft(db, { userId: anna, cardId: next })).toEqual({ ok: false, reason: "already_closed" });
  });
});

describe("skipCard", () => {
  test("closes the card for both, opens the next one and lets the partner see the skip", async () => {
    const id = await currentId();

    expect(await skip(anna, id)).toEqual({ ok: true });

    expect(await cardRows()).toHaveLength(2);
    expect(await answerRow(id, anna)).toMatchObject([{ status: "skipped", fields: {} }]);
    expect((await viewOf(boris)).card).toMatchObject({ position: 1, state: "skipped", partner: { status: "skipped" } });
    // Пропустивший видит тот же итог до своего «Продолжить»: после перезагрузки или на другом устройстве он не теряется
    expect((await viewOf(anna)).card).toMatchObject({ position: 1, state: "skipped", partner: { status: "none" } });
    await proceed(anna, id);
    expect((await viewOf(anna)).card).toMatchObject({ position: 2, state: "answer" });
  });

  test("skipping after my own answer wipes the text and leaves the result unseen until I continue", async () => {
    const id = await currentId();
    await put(anna, id, { answer: "мой черновик" });

    await skip(anna, id);

    expect(await answerRow(id, anna)).toMatchObject([{ status: "skipped", fields: {} }]);
    expect(await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, id), eq(togetherCardMarks.userId, anna)))).toEqual([]);
    expect(await skip(anna, (await cardRows()).find((card) => card.position === 2)!.id)).toEqual({ ok: false, reason: "reveal_pending" });
  });

  test("a skip while the partner has already answered never shows the partner's answer to the skipper", async () => {
    const id = await currentId();
    await put(boris, id, { answer: SECRET });

    await skip(anna, id);

    expect(await answerRow(id, boris)).toMatchObject([{ status: "submitted", fields: { answer: SECRET } }]);
    expect(JSON.stringify(await viewOf(anna))).not.toContain(SECRET);
    expect((await viewOf(boris)).card).toMatchObject({ position: 1, state: "skipped", mine: { fields: { answer: SECRET } }, partner: { status: "skipped" } });
  });

  test("a paid card cannot be skipped without access, so locked content is not lost", async () => {
    for (let i = 0; i < 2; i++) {
      const introId = await currentId();
      await reveal(introId);
      await proceed(anna, introId);
      await proceed(boris, introId);
    }
    const mainId = await currentId();

    expect(await skip(anna, mainId)).toEqual({ ok: false, reason: "access_required" });
    expect((await viewOf(anna)).card).toMatchObject({ position: 3, state: "answer" });

    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    expect(await skip(anna, mainId)).toEqual({ ok: true });
  });

  test("a skip is refused while the previous result is still unseen", async () => {
    const first = await currentId();
    await reveal(first);
    const second = (await cardRows()).find((card) => card.position === 2)!.id;

    expect(await skip(anna, second)).toEqual({ ok: false, reason: "reveal_pending" });
  });

  test("a card that forbids skipping refuses it", async () => {
    const strictTrack = [fixtureCard("strict-01", "intro", false), ...FIXTURE_TRACK];
    const strictId = (await viewOf(anna, strictTrack)).card!.id;

    expect(await skip(anna, strictId, strictTrack)).toEqual({ ok: false, reason: "skip_not_allowed" });
  });

  test("a closed card cannot be skipped again", async () => {
    const id = await currentId();
    await skip(anna, id);

    expect(await skip(boris, id)).toEqual({ ok: false, reason: "already_closed" });
  });
});

describe("continueCard", () => {
  test("marks the result as seen and 'done' only once the pair did the action; a skipped result cannot be done", async () => {
    const id = await currentId();
    await reveal(id);

    expect(await proceed(anna, id)).toEqual({ ok: true });
    expect(await proceed(anna, id, true)).toEqual({ ok: true });
    expect(await proceed(anna, id)).toEqual({ ok: true });
    const [mark] = await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, id), eq(togetherCardMarks.userId, anna)));
    expect(mark).toMatchObject({ seenAt: NOW, doneAt: NOW });
    expect((await viewOf(boris)).card?.partner).toMatchObject({ done: true });

    const next = await currentId(anna);
    await skip(anna, next);
    expect(await proceed(boris, next, true)).toEqual({ ok: true });
    const [skippedMark] = await db.select().from(togetherCardMarks).where(and(eq(togetherCardMarks.cardId, next), eq(togetherCardMarks.userId, boris)));
    expect(skippedMark?.doneAt).toBeNull();
  });

  test("refuses an open card", async () => {
    const id = await currentId();

    expect(await proceed(anna, id)).toEqual({ ok: false, reason: "not_closed" });
  });
});

describe("the end of the track", () => {
  test("does not issue another card after the last one", async () => {
    const shortTrack = FIXTURE_TRACK.slice(0, 1);
    const id = (await viewOf(anna, shortTrack)).card!.id;
    await put(anna, id, { answer: "a" }, shortTrack);
    await put(boris, id, { answer: "b" }, shortTrack);

    expect(await cardRows()).toHaveLength(1);
    await proceed(anna, id);
    await proceed(boris, id);
    expect((await viewOf(anna, shortTrack)).card).toBeNull();
  });
});

describe("months open by paid time", () => {
  const DAY_MS = 86_400_000;
  const at = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

  // Проходит вводную и карточку месяца 1, чтобы текущей стала карточка месяца 2
  async function reachMonthTwo(): Promise<string> {
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: NOW });
    for (let step = 0; step < 2; step++) {
      const id = (await loadCurrentCard(db, { userId: anna, track: UNLOCK_TRACK, now: at(1) }).then((r) => (r.ok ? r.card?.id : undefined)))!;
      await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "a" }, track: UNLOCK_TRACK, now: at(1) });
      await submitAnswer(db, { userId: boris, cardId: id, fields: { answer: "b" }, track: UNLOCK_TRACK, now: at(1) });
      await continueCard(db, { userId: anna, cardId: id, done: false, now: at(1) });
      await continueCard(db, { userId: boris, cardId: id, done: false, now: at(1) });
    }
    return (await loadCurrentCard(db, { userId: anna, track: UNLOCK_TRACK, now: at(1) }).then((r) => (r.ok ? r.card?.id : undefined)))!;
  }

  test("a month that needs more paid time refuses an answer and a skip, even with active access", async () => {
    const id = await reachMonthTwo();

    expect(await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "рано" }, track: UNLOCK_TRACK, now: at(5) })).toEqual({ ok: false, reason: "not_yet_open" });
    expect(await skipCard(db, { userId: anna, cardId: id, track: UNLOCK_TRACK, now: at(5) })).toEqual({ ok: false, reason: "not_yet_open" });
    expect(await answerRowOf(id)).toEqual([]);
  });

  test("without access the person is asked to pay first, not told to wait", async () => {
    const id = await reachMonthTwo();

    expect(await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "после срока" }, track: UNLOCK_TRACK, now: at(40) })).toEqual({ ok: false, reason: "access_required" });
  });

  test("opens once the second period carries the pair past 30 days of paid time", async () => {
    const id = await reachMonthTwo();
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: at(2) });

    expect(await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "ещё рано" }, track: UNLOCK_TRACK, now: at(29) })).toEqual({ ok: false, reason: "not_yet_open" });
    expect(await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "уже можно" }, track: UNLOCK_TRACK, now: at(31) })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("a person who already answered can still edit after the month is no longer reachable", async () => {
    const id = await reachMonthTwo();
    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: at(2) });
    await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "первый" }, track: UNLOCK_TRACK, now: at(31) });

    expect(await submitAnswer(db, { userId: anna, cardId: id, fields: { answer: "правка" }, track: UNLOCK_TRACK, now: at(32) })).toMatchObject({ ok: true, state: "waiting" });
  });
});
