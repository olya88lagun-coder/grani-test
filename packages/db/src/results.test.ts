import { beforeEach, describe, expect, test } from "vitest";
import {
  createResult,
  createTestDb,
  getLatestResultId,
  getResult,
  getResultForOwner,
  seedUserWithResult,
  upsertUserFromIdentity,
  type Database,
  type NewResult,
} from "./testing";

const CONSENT = { version: "2026-09-v1", at: new Date("2026-09-17T10:00:00Z") };
const SCORES = { openness: 70, conscientiousness: 40, extraversion: 65, agreeableness: 80, stability: 55 };

let db: Database;
let ownerId: string;
let strangerId: string;

async function createUser(externalId: string): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: "telegram", externalId, displayName: externalId, gender: null },
    CONSENT,
  );
  if (!outcome.ok) throw new Error("user was not created");
  return outcome.user.id;
}

function newResult(userId: string): NewResult {
  return { userId, answers: { "ipip-01": 5, "ipip-02": 1 }, scores: SCORES, typeCode: "+-++", stability: "calm" };
}

beforeEach(async () => {
  db = await createTestDb();
  ownerId = await createUser("owner");
  strangerId = await createUser("stranger");
});

describe("results", () => {
  test("stores a result and reads it back for its owner", async () => {
    const created = await createResult(db, newResult(ownerId));

    const read = await getResultForOwner(db, created.id, ownerId);

    expect(read).toMatchObject({ id: created.id, userId: ownerId, scores: SCORES, typeCode: "+-++", stability: "calm" });
    expect(read?.createdAt).toBeInstanceOf(Date);
  });

  test("hides a result from other users", async () => {
    const created = await createResult(db, newResult(ownerId));

    expect(await getResultForOwner(db, created.id, strangerId)).toBeNull();
  });

  test("returns null for a malformed result id instead of failing", async () => {
    expect(await getResultForOwner(db, "../../etc", ownerId)).toBeNull();
  });

  test("finds the latest result of a user", async () => {
    expect(await getLatestResultId(db, ownerId)).toBeNull();
    await createResult(db, newResult(ownerId));
    await new Promise((resolve) => setTimeout(resolve, 5)); // разные created_at у двух вставок
    const latest = await createResult(db, { ...newResult(ownerId), typeCode: "----" });

    expect(await getLatestResultId(db, ownerId)).toBe(latest.id);
  });
});

describe("getResult", () => {
  test("reads a result by id without an owner check", async () => {
    const { resultId } = await seedUserWithResult(db, { externalId: "worker-read" });

    expect((await getResult(db, resultId))?.id).toBe(resultId);
    expect(await getResult(db, "not-a-uuid")).toBeNull();
  });
});
