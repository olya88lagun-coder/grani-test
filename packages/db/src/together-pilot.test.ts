import { beforeEach, describe, expect, test } from "vitest";
import { grantPilotPass, hasPilotPass } from "./together-pilot";
import { createTestDb, seedUser } from "./testing";
import type { Database } from "./types";

const NOW = new Date("2026-10-07T10:00:00Z");

let db: Database;
let anna: string;
let boris: string;
let vera: string;

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna" });
  boris = await seedUser(db, { externalId: "boris" });
  vera = await seedUser(db, { externalId: "vera" });
});

describe("pilot passes", () => {
  test("a person without a pass has none, and a granted pass is remembered", async () => {
    expect(await hasPilotPass(db, anna)).toBe(false);

    expect(await grantPilotPass(db, { userId: anna, source: "code", limit: 2, now: NOW })).toBe("granted");

    expect(await hasPilotPass(db, anna)).toBe(true);
    expect(await hasPilotPass(db, boris)).toBe(false);
  });

  test("granting again is harmless and does not use another place of the limit", async () => {
    await grantPilotPass(db, { userId: anna, source: "code", limit: 1, now: NOW });

    expect(await grantPilotPass(db, { userId: anna, source: "code", limit: 1, now: NOW })).toBe("already");
  });

  test("the limit counts passes given by the code and stops the next one", async () => {
    await grantPilotPass(db, { userId: anna, source: "code", limit: 2, now: NOW });
    await grantPilotPass(db, { userId: boris, source: "code", limit: 2, now: NOW });

    expect(await grantPilotPass(db, { userId: vera, source: "code", limit: 2, now: NOW })).toBe("limit_reached");
    expect(await hasPilotPass(db, vera)).toBe(false);
  });

  test("a partner coming by an invite is not stopped by the limit and does not use a place", async () => {
    await grantPilotPass(db, { userId: anna, source: "code", limit: 1, now: NOW });

    expect(await grantPilotPass(db, { userId: boris, source: "invite", limit: 1, now: NOW })).toBe("granted");
    expect(await hasPilotPass(db, boris)).toBe(true);
    expect(await grantPilotPass(db, { userId: vera, source: "code", limit: 2, now: NOW })).toBe("granted");
  });

  test("simultaneous grants never exceed the limit", async () => {
    const people = [anna, boris, vera];

    const results = await Promise.all(people.map((userId) => grantPilotPass(db, { userId, source: "code", limit: 2, now: NOW })));

    expect(results.filter((result) => result === "granted")).toHaveLength(2);
    expect(results.filter((result) => result === "limit_reached")).toHaveLength(1);
  });
});
