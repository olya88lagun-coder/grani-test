import { SELF_ITEMS } from "@grani/content";
import { createTestDb, getResultForOwner, upsertUserFromIdentity, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { signPending, signSession, verifyPending } from "./auth/tokens";
import { computeResult, parseAnswers, savePendingResult, submitAnswers } from "./results-service";

const SECRET = "s".repeat(40);
const allAnswers = (value: number) => Object.fromEntries(SELF_ITEMS.map((item) => [item.id, value]));

let db: Database;

async function createUser(): Promise<string> {
  const outcome = await upsertUserFromIdentity(
    db,
    { provider: "telegram", externalId: "42", displayName: "Аня", gender: null },
    { version: "2026-09-v1", at: new Date() },
  );
  if (!outcome.ok) throw new Error("user was not created");
  return outcome.user.id;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("submitAnswers is safe to repeat", () => {
  const MINUTE_MS = 60_000;

  async function signedIn() {
    return signSession(await createUser(), SECRET);
  }

  test("a repeated submission of the same answers returns the same result instead of creating a duplicate", async () => {
    const session = await signedIn();

    const first = await submitAnswers({ db, secret: SECRET }, allAnswers(4), session);
    const second = await submitAnswers({ db, secret: SECRET }, allAnswers(4), session);

    expect(first.kind).toBe("saved");
    expect(second).toEqual(first);
  });

  test("different answers make a new result, and so does the same test taken again after the window", async () => {
    const session = await signedIn();
    const first = await submitAnswers({ db, secret: SECRET }, allAnswers(4), session);

    const other = await submitAnswers({ db, secret: SECRET }, allAnswers(2), session);
    const later = await submitAnswers({ db, secret: SECRET, now: () => new Date(Date.now() + 11 * MINUTE_MS) }, allAnswers(4), session);

    expect(other).not.toEqual(first);
    expect(later).not.toEqual(first);
  });

  test("two people with identical answers each get their own result", async () => {
    const first = await submitAnswers({ db, secret: SECRET }, allAnswers(3), await signedIn());
    const outcome = await upsertUserFromIdentity(
      db,
      { provider: "telegram", externalId: "43", displayName: "Боря", gender: null },
      { version: "2026-09-v1", at: new Date() },
    );
    if (!outcome.ok) throw new Error("user was not created");

    const second = await submitAnswers({ db, secret: SECRET }, allAnswers(3), await signSession(outcome.user.id, SECRET));

    expect(second).not.toEqual(first);
  });

  test("saving the same pending result twice at sign-in gives one result", async () => {
    const userId = await createUser();
    const token = await signPending(allAnswers(5) as never, SECRET);

    const first = await savePendingResult({ db, secret: SECRET }, userId, token);
    const second = await savePendingResult({ db, secret: SECRET }, userId, token);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
});

describe("parseAnswers", () => {
  test("accepts all 50 answers in range", () => {
    expect(parseAnswers(allAnswers(3))).toEqual(allAnswers(3));
  });

  test.each([
    ["a missing answer", Object.fromEntries(SELF_ITEMS.slice(1).map((item) => [item.id, 3]))],
    ["an unknown key", { ...allAnswers(3), extra: 3 }],
    ["an out-of-range value", { ...allAnswers(3), "ipip-07": 6 }],
    ["a fractional value", { ...allAnswers(3), "ipip-07": 2.5 }],
    ["a string value", { ...allAnswers(3), "ipip-07": "5" }],
    ["an array", [1, 2, 3]],
    ["null", null],
  ])("rejects %s", (_, raw) => {
    expect(parseAnswers(raw)).toBeNull();
  });
});

describe("computeResult", () => {
  test("scores IPIP-50 answers, derives the type and the stability note", () => {
    // Все ответы «5»: extraversion 5+/5- → 50; agreeableness и conscientiousness 6+/4- → 60;
    // stability 2+/8- → 20; openness 7+/3- → 70
    const result = computeResult(parseAnswers(allAnswers(5))!);

    expect(result.scores).toEqual({ openness: 70, conscientiousness: 60, extraversion: 50, agreeableness: 60, stability: 20 });
    expect(result.typeCode).toBe("++++");
    expect(result.stability).toBe("sensitive");
  });
});

describe("submitAnswers", () => {
  test("rejects invalid answers", async () => {
    expect(await submitAnswers({ db, secret: SECRET }, { "ipip-01": 5 }, null)).toEqual({ kind: "invalid" });
  });

  test("saves the result right away for a signed-in user", async () => {
    const userId = await createUser();

    const outcome = await submitAnswers({ db, secret: SECRET }, allAnswers(4), await signSession(userId, SECRET));

    expect(outcome.kind).toBe("saved");
    const saved = outcome.kind === "saved" ? await getResultForOwner(db, outcome.resultId, userId) : null;
    expect(saved?.answers).toEqual(allAnswers(4));
  });

  test("returns a pending token for an anonymous visitor", async () => {
    const outcome = await submitAnswers({ db, secret: SECRET }, allAnswers(2), null);

    expect(outcome.kind).toBe("pending");
    expect(outcome.kind === "pending" && (await verifyPending(outcome.pendingToken, SECRET))).toEqual(allAnswers(2));
  });

  test("treats a session of a deleted or unknown user as anonymous", async () => {
    const token = await signSession("00000000-0000-0000-0000-000000000000", SECRET);

    expect((await submitAnswers({ db, secret: SECRET }, allAnswers(2), token)).kind).toBe("pending");
  });
});

describe("savePendingResult", () => {
  test("stores pending answers for the user", async () => {
    const userId = await createUser();
    const token = await signPending(parseAnswers(allAnswers(1))!, SECRET);

    const resultId = await savePendingResult({ db, secret: SECRET }, userId, token);

    expect(resultId && (await getResultForOwner(db, resultId, userId))?.answers).toEqual(allAnswers(1));
  });

  test("ignores a missing, forged or invalid pending token", async () => {
    const userId = await createUser();
    const forged = await signPending(parseAnswers(allAnswers(1))!, "x".repeat(40));
    const incomplete = await signPending({ "ipip-01": 5 }, SECRET);

    expect(await savePendingResult({ db, secret: SECRET }, userId, null)).toBeNull();
    expect(await savePendingResult({ db, secret: SECRET }, userId, forged)).toBeNull();
    expect(await savePendingResult({ db, secret: SECRET }, userId, incomplete)).toBeNull();
  });
});
