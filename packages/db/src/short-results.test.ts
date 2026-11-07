import { beforeEach, describe, expect, test } from "vitest";
import {
  createPurchase,
  createTestDb,
  deleteUserData,
  findOpenPurchase,
  getPurchase,
  getShortResultForOwner,
  hasPaidShortProduct,
  listOwnedProducts,
  markPurchaseSucceeded,
  saveShortResult,
  seedUser,
  seedUserWithResult,
  type Database,
} from "./testing";

let db: Database;
let annaId: string;

const sample = { testSlug: "attachment", answers: { an01: 4, av01: 2 }, scores: { anxiety: 75, avoidance: 25 }, typeKey: "anxious" };

beforeEach(async () => {
  db = await createTestDb();
  annaId = await seedUser(db, { externalId: "anna" });
});

describe("short test results", () => {
  test("are saved and read back by their owner only", async () => {
    const saved = await saveShortResult(db, { userId: annaId, ...sample });
    expect(saved).toMatchObject({ userId: annaId, ...sample });
    expect(await getShortResultForOwner(db, saved.id, annaId)).toEqual(saved);
    const boris = await seedUser(db, { externalId: "boris" });
    expect(await getShortResultForOwner(db, saved.id, boris)).toBeNull();
    expect(await getShortResultForOwner(db, "not-a-uuid", annaId)).toBeNull();
  });
});

describe("purchases for short test results", () => {
  test("a purchase can target a short result, and owned products are listed per result", async () => {
    const result = await saveShortResult(db, { userId: annaId, ...sample });
    const purchase = await createPurchase(db, { userId: annaId, product: "attachment_solo", target: { shortResultId: result.id }, amountKopecks: 19900 });
    expect(purchase).toMatchObject({ shortResultId: result.id, resultId: null, pairId: null, spaceId: null });
    expect(await listOwnedProducts(db, { shortResultId: result.id })).toEqual([]);
    await markPurchaseSucceeded(db, purchase.id, new Date());
    expect(await listOwnedProducts(db, { shortResultId: result.id })).toEqual(["attachment_solo"]);
  });

  test("an open purchase is found again for the same short result", async () => {
    const result = await saveShortResult(db, { userId: annaId, ...sample });
    const purchase = await createPurchase(db, { userId: annaId, product: "attachment_solo", target: { shortResultId: result.id }, amountKopecks: 19900 });
    const { attachPayment } = await import("./testing");
    await attachPayment(db, purchase.id, { paymentId: "pay-1", confirmationUrl: "https://pay.example/1" });
    const open = await findOpenPurchase(db, { userId: annaId, product: "attachment_solo", target: { shortResultId: result.id }, since: new Date(0) });
    expect(open?.id).toBe(purchase.id);
  });

  test("hasPaidShortProduct is true only after a succeeded purchase of that user", async () => {
    const result = await saveShortResult(db, { userId: annaId, ...sample });
    expect(await hasPaidShortProduct(db, { userId: annaId, product: "attachment_solo" })).toBe(false);
    const purchase = await createPurchase(db, { userId: annaId, product: "attachment_solo", target: { shortResultId: result.id }, amountKopecks: 19900 });
    expect(await hasPaidShortProduct(db, { userId: annaId, product: "attachment_solo" })).toBe(false);
    await markPurchaseSucceeded(db, purchase.id, new Date());
    expect(await hasPaidShortProduct(db, { userId: annaId, product: "attachment_solo" })).toBe(true);
    const boris = await seedUser(db, { externalId: "boris" });
    expect(await hasPaidShortProduct(db, { userId: boris, product: "attachment_solo" })).toBe(false);
  });

  test("a purchase cannot target a Big Five result and a short result at once", async () => {
    const withResult = await seedUserWithResult(db, { externalId: "vera" });
    const short = await saveShortResult(db, { userId: withResult.userId, ...sample });
    const { purchases } = await import("./schema");
    await expect(
      db.insert(purchases).values({ userId: withResult.userId, product: "attachment_solo", resultId: withResult.resultId, shortResultId: short.id, amountKopecks: 19900 }),
    ).rejects.toThrow();
  });

  test("deleting the user removes short results but keeps the purchase with a cleared link", async () => {
    const result = await saveShortResult(db, { userId: annaId, ...sample });
    const purchase = await createPurchase(db, { userId: annaId, product: "attachment_solo", target: { shortResultId: result.id }, amountKopecks: 19900 });
    await markPurchaseSucceeded(db, purchase.id, new Date());
    await deleteUserData(db, annaId);
    expect(await getShortResultForOwner(db, result.id, annaId)).toBeNull();
    const kept = await getPurchase(db, purchase.id);
    expect(kept?.shortResultId ?? null).toBeNull();
  });
});
