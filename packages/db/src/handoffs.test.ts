import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, saveHandoff, takeHandoff, type Database } from "./testing";

let db: Database;
const NOW = new Date("2026-09-26T10:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

beforeEach(async () => {
  db = await createTestDb();
});

describe("handoffs", () => {
  test("a code returns the saved pending result until it expires", async () => {
    await saveHandoff(db, { code: "code-1", pendingToken: "pending-token", expiresAt: minutes(30) }, NOW);

    expect(await takeHandoff(db, "code-1", minutes(5))).toBe("pending-token");
    // Ссылку можно открыть повторно, пока она жива: встроенный браузер мог сам перезагрузить страницу
    expect(await takeHandoff(db, "code-1", minutes(10))).toBe("pending-token");
    expect(await takeHandoff(db, "code-1", minutes(31))).toBeNull();
  });

  test("an unknown code returns nothing", async () => {
    expect(await takeHandoff(db, "missing", NOW)).toBeNull();
  });

  test("saving a new code clears expired ones", async () => {
    await saveHandoff(db, { code: "old", pendingToken: "a", expiresAt: minutes(1) }, NOW);
    await saveHandoff(db, { code: "new", pendingToken: "b", expiresAt: minutes(60) }, minutes(30));

    const rows = await db.query.pendingHandoffs.findMany();
    expect(rows.map((row) => row.code)).toEqual(["new"]);
  });
});
