import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestDb, deleteUserData, purchases, reports, seedUserWithResult, type Database } from "@grani/db/testing";
import { initialMoneyData } from "@/lib/money-practice";
import { readPractice, savePractice } from "./practice-service";

let db: Database;
let single: { userId: string; resultId: string }, bundle: typeof single, unpaid: typeof single, other: typeof single;
beforeAll(async () => {
  db = await createTestDb();
  single = await seedUserWithResult(db, { externalId: "money-old-purchase" });
  bundle = await seedUserWithResult(db, { externalId: "money-old-bundle" });
  unpaid = await seedUserWithResult(db, { externalId: "money-full-only" });
  other = await seedUserWithResult(db, { externalId: "money-other" });
  await db.insert(purchases).values([
    { userId: single.userId, resultId: single.resultId, product: "chapter_money", amountKopecks: 9900, status: "succeeded", paidAt: new Date("2026-09-25") },
    { userId: bundle.userId, resultId: bundle.resultId, product: "chapters_all", amountKopecks: 24900, status: "succeeded", paidAt: new Date("2026-09-25") },
    { userId: unpaid.userId, resultId: unpaid.resultId, product: "full", amountKopecks: 29900, status: "succeeded", paidAt: new Date() },
  ]);
});
afterAll(async () => { await (db as unknown as { $client: { close(): Promise<void> } }).$client.close(); });
test("previous chapter and bundle purchases unlock the upgrade even before generation", async () => {
  expect(await readPractice(db, { ...single, key: "money" })).toMatchObject({ ok: true, draft: { revision: 0 } });
  expect(await readPractice(db, { ...bundle, key: "money" })).toMatchObject({ ok: true });
  expect(await readPractice(db, { ...unpaid, key: "money" })).toEqual({ ok: false, error: "access_required" });
  expect(await readPractice(db, { ...single, key: "stress" })).toEqual({ ok: false, error: "not_found" });
  await db.insert(reports).values({resultId: single.resultId, kind: "chapter_money", sections: {text: "Старый персональный отчёт", tips: ["Старая рекомендация"]}, source: "fallback"});
  await db.insert(reports).values({resultId: single.resultId, kind: "full", sections: {portrait: "Старый полный разбор", manual: {work: ["Текст владельца"]}}, source: "fallback"});
});
test("foreign owners cannot read or write and stale versions cannot overwrite", async () => {
  const data = initialMoneyData(); data.answers[0] = "c"; data.memo = "Моя приватная памятка";
  const oldPurchases = await db.select().from(purchases), oldReports = await db.select().from(reports);
  expect(await savePractice(db, { ...single, userId: other.userId, key: "money", expectedRevision: 0, data })).toEqual({ ok: false, error: "not_found" });
  expect(await readPractice(db, { ...single, userId: other.userId, key: "money" })).toEqual({ ok: false, error: "not_found" });
  expect(await savePractice(db, { ...single, key: "money", expectedRevision: 0, data })).toMatchObject({ ok: true, draft: { revision: 1 } });
  expect(await savePractice(db, { ...single, key: "money", expectedRevision: 0, data: initialMoneyData() })).toEqual({ ok: false, error: "conflict" });
  expect(await readPractice(db, { ...single, key: "money" })).toMatchObject({ ok: true, draft: { data: { memo: "Моя приватная памятка", answers: ["c", null, null, null, null, null] } } });
  expect(await db.select().from(purchases)).toEqual(oldPurchases);
  expect(await db.select().from(reports)).toEqual(oldReports);
  expect(await savePractice(db, { ...single, key: "money", expectedRevision: 1, data: { ...data, hidden: "field" } })).toEqual({ ok: false, error: "invalid" });
  const race = await Promise.all([1, 2].map(() => savePractice(db, { ...single, key: "money", expectedRevision: 1, data })));
  expect(race.filter(r => r.ok)).toHaveLength(1);
  expect(race.filter(r => !r.ok && r.error === "conflict")).toHaveLength(1);
});
test("refund removes access without deleting the private draft; deletion removes draft via result cascade", async () => {
  const { eq } = await import("drizzle-orm"), { practiceDrafts } = await import("@grani/db");
  await db.update(purchases).set({ status: "refunded" }).where(eq(purchases.resultId, single.resultId));
  expect(await readPractice(db, { ...single, key: "money" })).toEqual({ ok: false, error: "access_required" });
  expect(await db.select().from(practiceDrafts)).toHaveLength(1);
  await deleteUserData(db, single.userId);
  expect(await db.select().from(practiceDrafts)).toHaveLength(0);
});
