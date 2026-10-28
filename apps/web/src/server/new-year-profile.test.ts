import { afterEach, expect, test } from "vitest";
import { createTestDb, seedUserWithResult } from "@grani/db/testing";
import { getYearProfile } from "./new-year-profile";

const opened: Awaited<ReturnType<typeof createTestDb>>[] = [];
afterEach(async () => { for (const db of opened.splice(0)) await (db as unknown as { $client: { close(): Promise<void> } }).$client.close(); });
test("uses only the authenticated owner's latest result and exposes no identity or result id", async () => {
  const db = await createTestDb(); opened.push(db);
  const a = await seedUserWithResult(db, { externalId: "year-a", scores: { openness: 80, conscientiousness: 20, extraversion: 30, agreeableness: 60, stability: 40 } });
  await seedUserWithResult(db, { externalId: "year-b", scores: { openness: 10, conscientiousness: 90, extraversion: 80, agreeableness: 20, stability: 60 } });
  const profile = await getYearProfile(db, a.userId);
  expect(profile).toEqual({ status: "available", scores: { openness: 80, conscientiousness: 20, extraversion: 30, agreeableness: 60, stability: 40 } });
  expect(await getYearProfile(db, null)).toEqual({ status: "guest" });
  expect(await getYearProfile(db, "00000000-0000-4000-8000-000000000099")).toEqual({ status: "missing" });
});
