import type { CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCards } from "@grani/db";
import { createTestDb, seedTogetherSpace, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { getTogetherCareCard } from "./together-care-service";
import type { TogetherDeps } from "./together-service";

const CLOSED = new Date("2026-10-07T10:00:00Z");

let db: Database;
let deps: TogetherDeps;
let spaceId: string;
let anna: string;
let boris: string;
let position = 0;

const snapshot = (id: string): CardSnapshot => ({ id, version: 1, kind: "main", title: id, estimatedMinutes: 5, prompt: "Вопрос?", hint: "Подсказка", jointAction: "Сделайте", skipAllowed: true, fields: [] });

async function closedCard(cardId: string): Promise<string> {
  position += 1;
  const [row] = await db.insert(togetherCards).values({ spaceId, cardId, position, snapshot: snapshot(cardId), closedAt: CLOSED }).returning({ id: togetherCards.id });
  return row!.id;
}

const answer = (cardUuid: string, userId: string, fields: Record<string, string | boolean>) => db.insert(togetherAnswers).values({ cardId: cardUuid, spaceId, userId, status: "submitted", fields });

beforeEach(async () => {
  db = await createTestDb();
  position = 0;
  deps = { db, now: () => CLOSED, appUrl: "http://localhost:3000" };
  ({ spaceId, initiatorId: anna, partnerId: boris } = await seedTogetherSpace(db));
});

describe("getTogetherCareCard", () => {
  test("a person without a space gets not_found", async () => {
    const vera = await seedUser(db, { externalId: "vera" });

    expect(await getTogetherCareCard(deps, { userId: vera })).toEqual({ ok: false, error: "not_found" });
  });

  test("is not ready before the month card is closed", async () => {
    const d14 = await closedCard("m01-d14");
    await answer(d14, anna, { answer: "а", care_action: "Спросить", allow_care_reward: true });

    expect(await getTogetherCareCard(deps, { userId: anna })).toEqual({ ok: true, ready: false });
  });

  test("builds the card from the items the authors offered, each under its author, with first names", async () => {
    const [d14, d15, d17, d24] = await Promise.all([closedCard("m01-d14"), closedCard("m01-d15"), closedCard("m01-d17"), closedCard("m01-d24")]);
    await closedCard("m01-d26");
    await answer(d14, anna, { answer: "длинный ответ", care_action: "Спросить, что нужно", care_context: "Когда я устала", allow_care_reward: true });
    await answer(d15, anna, { answer: "ещё", care_action: "Дать время", allow_care_reward: true });
    await answer(d17, boris, { answer: "и ещё", care_action: "Позвать погулять", allow_care_reward: true });
    await answer(d24, boris, { answer: "ритуал", care_action: "Чай по воскресеньям", care_context: "Вечером", allow_care_reward: true });
    // Карточка раскрыта, когда ответили оба: ответы второго участника без пунктов для итога
    await answer(d14, boris, { answer: "б" });
    await answer(d15, boris, { answer: "б" });
    await answer(d17, anna, { answer: "а" });
    await answer(d24, anna, { answer: "а" });

    const result = await getTogetherCareCard(deps, { userId: boris });

    expect(result).toMatchObject({ ok: true, ready: true, card: { title: "Наши способы заботы", complete: false, empty: false } });
    const card = result.ok && result.ready ? result.card : null;
    const byName = Object.fromEntries(card!.members.map((member) => [member.name, member]));
    expect(byName["Аня"]).toMatchObject({ attention: [{ text: "Спросить, что нужно", context: "Когда я устала" }], ease: [{ text: "Дать время", context: null }] });
    expect(byName["Борис"]).toMatchObject({ attention: [{ text: "Позвать погулять" }], ease: [] });
    expect(card!.rituals).toEqual([{ ownerId: boris, ownerName: "Борис", text: "Чай по воскресеньям", context: "Вечером" }]);
  });

  test("an item of a card that the partner skipped is not shown even with the author's mark", async () => {
    const d14 = await closedCard("m01-d14");
    await closedCard("m01-d26");
    await answer(d14, anna, { answer: "а", care_action: "СКРЫТО ПОТОМУ ЧТО ПРОПУЩЕНО", allow_care_reward: true });
    await db.insert(togetherAnswers).values({ cardId: d14, spaceId, userId: boris, status: "skipped", fields: {} });

    const result = await getTogetherCareCard(deps, { userId: boris });

    expect(result).toMatchObject({ ok: true, ready: true, card: { empty: true } });
    expect(JSON.stringify(result)).not.toContain("СКРЫТО");
  });

  test("an item without the author's mark is left out, and free text of the answer never gets into the card", async () => {
    const d14 = await closedCard("m01-d14");
    await closedCard("m01-d26");
    await answer(d14, anna, { answer: "ЛИЧНЫЙ ОТВЕТ", care_action: "Без отметки", allow_care_reward: false });
    await answer(d14, boris, { answer: "ТОЖЕ ЛИЧНЫЙ", care_action: "Нет поля согласия" });

    const result = await getTogetherCareCard(deps, { userId: anna });

    expect(result).toMatchObject({ ok: true, ready: true, card: { empty: true } });
    expect(JSON.stringify(result)).not.toContain("ЛИЧНЫЙ");
    expect(JSON.stringify(result)).not.toContain("Без отметки");
  });

  test("both partners get the same card", async () => {
    const d14 = await closedCard("m01-d14");
    await closedCard("m01-d26");
    await answer(d14, anna, { answer: "а", care_action: "Спросить", allow_care_reward: true });
    await answer(d14, boris, { answer: "б" });

    expect(await getTogetherCareCard(deps, { userId: anna })).toEqual(await getTogetherCareCard(deps, { userId: boris }));
  });
});
