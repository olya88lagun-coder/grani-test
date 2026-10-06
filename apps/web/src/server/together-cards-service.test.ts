import { createTestDb, seedTogetherAccess, seedTogetherSpace, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import {
  answerTogetherCard,
  continueTogetherCard,
  deleteTogetherDraft,
  getCurrentTogetherCard,
  getTogetherHistory,
  skipTogetherCard,
} from "./together-cards-service";
import { getTogetherSpaceView, type TogetherDeps } from "./together-service";

const START = new Date("2026-10-05T10:00:00Z");

let db: Database;
let deps: TogetherDeps;
let spaceId: string;
let anna: string;
let boris: string;

async function current(userId: string) {
  const result = await getCurrentTogetherCard(deps, userId);
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function cardId(userId = anna): Promise<string> {
  const { card } = await current(userId);
  if (!card) throw new Error("no card");
  return card.id;
}

// Проходит одну карточку: оба отвечают, оба нажимают «Продолжить»
async function playCard() {
  const id = await cardId();
  await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "Аня" } });
  await answerTogetherCard(deps, { userId: boris, cardId: id, fields: { answer: "Борис" } });
  await continueTogetherCard(deps, { userId: anna, cardId: id, done: false });
  await continueTogetherCard(deps, { userId: boris, cardId: id, done: false });
}

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, now: () => START, appUrl: "http://localhost:3000" };
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db, { now: START }));
});

describe("getCurrentTogetherCard", () => {
  test("starts with the first free intro card and a 29-card track", async () => {
    const result = await current(anna);

    expect(result.progress).toEqual({ done: 0, total: 29 });
    expect(result.card).toMatchObject({ position: 1, kind: "intro", state: "answer", locked: false, mine: null, partner: { status: "none" } });
    expect(result.card?.title).toBe("Замечать хорошее");
    expect(result.card?.fields.map((field) => field.id)).toEqual(["answer", "share_in_book"]);
  });

  test("locks the first paid card until access is paid, then lets the pair answer", async () => {
    for (let i = 0; i < 3; i++) await playCard();

    const locked = await current(anna);
    expect(locked.card).toMatchObject({ position: 4, kind: "main", state: "answer", locked: true });
    expect(await answerTogetherCard(deps, { userId: anna, cardId: locked.card!.id, fields: { answer: "платная" } })).toEqual({ ok: false, error: "access_required" });

    await seedTogetherAccess(db, { spaceId, userId: anna, paidAt: START });
    expect((await current(anna)).card?.locked).toBe(false);
    expect(await answerTogetherCard(deps, { userId: anna, cardId: locked.card!.id, fields: { answer: "платная" } })).toMatchObject({ ok: true, state: "waiting" });
  });

  test("a person outside a space gets not_found", async () => {
    const result = await getCurrentTogetherCard(deps, "00000000-0000-4000-8000-000000000000");

    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("answers, drafts and skips", () => {
  test("maps the reveal to an API card for the one who completes it", async () => {
    const id = await cardId();
    await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "Аня" } });

    const outcome = await answerTogetherCard(deps, { userId: boris, cardId: id, fields: { answer: "Борис" } });

    expect(outcome).toMatchObject({
      ok: true,
      state: "revealed",
      revealed: { card: { state: "revealed", mine: { fields: { answer: "Борис" } }, partner: { fields: { answer: "Аня" } }, locked: false } },
    });
  });

  test("passes errors through as stable codes", async () => {
    const id = await cardId();

    expect(await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "" } })).toEqual({ ok: false, error: "invalid_field" });
    expect(await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "ок", share_in_book: true } })).toEqual({ ok: false, error: "field_not_available" });
    await answerTogetherCard(deps, { userId: anna, cardId: id, fields: { answer: "черновик" } });
    expect(await deleteTogetherDraft(deps, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await skipTogetherCard(deps, { userId: anna, cardId: id })).toEqual({ ok: true });
    expect(await skipTogetherCard(deps, { userId: boris, cardId: id })).toEqual({ ok: false, error: "already_closed" });
  });

  test("validates the 'done' flag of continue", async () => {
    const id = await cardId();
    await skipTogetherCard(deps, { userId: anna, cardId: id });

    expect(await continueTogetherCard(deps, { userId: boris, cardId: id, done: "yes" })).toEqual({ ok: false, error: "invalid" });
    expect(await continueTogetherCard(deps, { userId: boris, cardId: id, done: undefined })).toEqual({ ok: true });
  });
});

describe("getTogetherHistory", () => {
  test("lists played cards and validates the cursor", async () => {
    await playCard();

    const history = await getTogetherHistory(deps, { userId: anna, before: undefined });
    expect(history).toMatchObject({ ok: true, items: [{ position: 1, outcome: "revealed", title: "Замечать хорошее" }], next: null });
    expect(await getTogetherHistory(deps, { userId: anna, before: "abc" })).toEqual({ ok: false, error: "invalid" });
    expect(await getTogetherHistory(deps, { userId: anna, before: "0" })).toEqual({ ok: false, error: "invalid" });
    expect(await getTogetherHistory(deps, { userId: anna, before: "2" })).toMatchObject({ ok: true });
  });
});

describe("space view progress", () => {
  test("reports how many cards the pair has completed", async () => {
    expect((await getTogetherSpaceView(deps, anna))?.progress).toEqual({ done: 0, total: 29 });

    await playCard();

    expect((await getTogetherSpaceView(deps, boris))?.progress).toEqual({ done: 1, total: 29 });
  });
});
