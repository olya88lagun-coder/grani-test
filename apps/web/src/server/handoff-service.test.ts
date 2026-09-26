import { SELF_ITEMS } from "@grani/content";
import { createTestDb, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { signPending } from "./auth/tokens";
import { createHandoff, HANDOFF_TTL_MS, restoreHandoff } from "./handoff-service";
import { parseAnswers } from "./results-service";

const SECRET = "test-secret-at-least-32-characters-long";
const START = Date.parse("2026-09-26T10:00:00Z");
let db: Database;
let now = START;
const deps = () => ({ db, secret: SECRET, now: () => now });
const pending = () => signPending(parseAnswers(Object.fromEntries(SELF_ITEMS.map((item) => [item.id, 4])))!, SECRET);

beforeEach(async () => {
  db = await createTestDb();
  now = START;
});

describe("handoff", () => {
  test("moves a pending result to another browser by a short code", async () => {
    const token = await pending();
    const created = await createHandoff(deps(), token);
    expect(created?.code).toMatch(/^[A-Za-z0-9_-]{24}$/);

    now += HANDOFF_TTL_MS - 1000;
    expect(await restoreHandoff(deps(), created!.code)).toBe(token);
  });

  test("an expired code restores nothing", async () => {
    const created = await createHandoff(deps(), await pending());
    now += HANDOFF_TTL_MS + 1000;
    expect(await restoreHandoff(deps(), created!.code)).toBeNull();
  });

  test("without a valid pending result there is nothing to move", async () => {
    expect(await createHandoff(deps(), null)).toBeNull();
    expect(await createHandoff(deps(), "forged")).toBeNull();
    expect(await restoreHandoff(deps(), "not a code")).toBeNull();
  });
});
