import { scoreShortTest, type Answer } from "@grani/core";
import { getShortTest } from "@grani/content/short-tests";
import { createPurchase, createTestDb, markPurchaseSucceeded, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { saveShortAnswers, shortResultPage } from "./short-results-service";

const attachment = getShortTest("attachment")!;
const anxious = Object.fromEntries(attachment.scoring.items.map((i) => [i.id, ((i.axis === "anxiety") !== i.reverse ? 5 : 1) as Answer]));

let db: Database;
let anna: string;

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
});

describe("saveShortAnswers", () => {
  test("rejects unknown tests, incomplete and out-of-range answers", async () => {
    expect(await saveShortAnswers({ db }, { userId: anna, slug: "nope", answers: anxious })).toEqual({ ok: false });
    expect(await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: { an01: 3 } })).toEqual({ ok: false });
    expect(await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: { ...anxious, an01: 7 } })).toEqual({ ok: false });
    expect(await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: "x" })).toEqual({ ok: false });
  });

  test("saves server-computed scores, not the client's", async () => {
    const saved = await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: anxious });
    expect(saved.ok).toBe(true);
    const page = await shortResultPage({ db }, { id: saved.ok ? saved.id : "", userId: anna });
    expect(page?.score).toEqual(scoreShortTest(attachment.scoring, anxious));
  });
});

describe("shortResultPage", () => {
  test("is null for someone else", async () => {
    const saved = await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: anxious });
    const boris = await seedUser(db, { externalId: "boris" });
    expect(await shortResultPage({ db }, { id: saved.ok ? saved.id : "", userId: boris })).toBeNull();
  });

  test("shows the buy offer before payment and the report after, also for a retaken test", async () => {
    const first = await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: anxious });
    const firstId = first.ok ? first.id : "";
    const before = await shortResultPage({ db }, { id: firstId, userId: anna });
    expect(before).toMatchObject({ report: null, canBuy: true });

    const purchase = await createPurchase(db, { userId: anna, product: "attachment_solo", target: { shortResultId: firstId }, amountKopecks: 19900 });
    await markPurchaseSucceeded(db, purchase.id, new Date());
    const after = await shortResultPage({ db }, { id: firstId, userId: anna });
    expect(after?.report?.sections.length).toBeGreaterThan(0);
    expect(after?.canBuy).toBe(false);

    const retaken = await saveShortAnswers({ db }, { userId: anna, slug: "attachment", answers: anxious });
    const again = await shortResultPage({ db }, { id: retaken.ok ? retaken.id : "", userId: anna });
    expect(again?.report).not.toBeNull();
    expect(again?.canBuy).toBe(false);
  });

  test("answers of a test without a paid report are never stored", async () => {
    const temperament = getShortTest("temperament")!;
    const answers = Object.fromEntries(temperament.items.map((i) => [i.id, 3 as Answer]));
    expect(await saveShortAnswers({ db }, { userId: anna, slug: "temperament", answers })).toEqual({ ok: false });
  });
});
