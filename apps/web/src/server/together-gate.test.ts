import { hasPilotPass } from "@grani/db";
import { createTestDb, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import type { TogetherConfig } from "./env";
import { admitInvitedPartner, redeemPilotCode, requestJoinAdmitting, togetherAdmission, type GateDeps } from "./together-gate";
import { createTogetherSpace, type TogetherDeps } from "./together-service";

const CODE = "granitsa-2026";
const PILOT: TogetherConfig = { mode: "pilot", pilotCode: CODE, pilotLimit: 2 };

let db: Database;
let anna: string;
let boris: string;
let vera: string;
let owner: string;

const deps = (together: TogetherConfig = PILOT): GateDeps => ({ db, now: () => new Date("2026-10-07T10:00:00Z"), together, owner: { provider: "vk", externalId: "owner-1" } });

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", provider: "vk" });
  boris = await seedUser(db, { externalId: "boris", provider: "vk" });
  vera = await seedUser(db, { externalId: "vera", provider: "vk" });
  owner = await seedUser(db, { externalId: "owner-1", provider: "vk" });
});

describe("togetherAdmission", () => {
  test("everyone is let in when the mode is open, and nobody when it is off, even the owner", async () => {
    expect(await togetherAdmission(deps({ ...PILOT, mode: "open" }), anna)).toBe("allowed");
    expect(await togetherAdmission(deps({ ...PILOT, mode: "off" }), anna)).toBe("unavailable");
    expect(await togetherAdmission(deps({ ...PILOT, mode: "off" }), owner)).toBe("unavailable");
  });

  test("in the pilot only the owner and the people with a pass get in", async () => {
    expect(await togetherAdmission(deps(), anna)).toBe("needs_pass");
    expect(await togetherAdmission(deps(), owner)).toBe("allowed");

    await redeemPilotCode(deps(), { userId: anna, code: CODE });

    expect(await togetherAdmission(deps(), anna)).toBe("allowed");
    expect(await togetherAdmission(deps(), boris)).toBe("needs_pass");
  });

  test("a visitor who is not signed in has no pass in the pilot", async () => {
    expect(await togetherAdmission(deps(), null)).toBe("needs_pass");
    expect(await togetherAdmission(deps({ ...PILOT, mode: "open" }), null)).toBe("allowed");
  });
});

describe("redeemPilotCode", () => {
  test("a right code gives a pass; it is forgiving about case and spaces", async () => {
    expect(await redeemPilotCode(deps(), { userId: anna, code: `  ${CODE.toUpperCase()} ` })).toEqual({ ok: true });

    expect(await hasPilotPass(db, anna)).toBe(true);
  });

  test("a wrong or empty code gives nothing and says only that the code is wrong", async () => {
    for (const code of ["", "granitsa-2025", "g", CODE.slice(0, -1), `${CODE}x`]) {
      expect(await redeemPilotCode(deps(), { userId: anna, code })).toEqual({ ok: false, error: "invalid_code" });
    }

    expect(await hasPilotPass(db, anna)).toBe(false);
  });

  test("entering the code again is harmless", async () => {
    await redeemPilotCode(deps(), { userId: anna, code: CODE });

    expect(await redeemPilotCode(deps(), { userId: anna, code: CODE })).toEqual({ ok: true });
  });

  test("the pilot limit stops the next person with the right code", async () => {
    await redeemPilotCode(deps(), { userId: anna, code: CODE });
    await redeemPilotCode(deps(), { userId: boris, code: CODE });

    expect(await redeemPilotCode(deps(), { userId: vera, code: CODE })).toEqual({ ok: false, error: "limit_reached" });
    expect(await hasPilotPass(db, vera)).toBe(false);
  });

  test("there is nothing to enter when the pilot is not running", async () => {
    expect(await redeemPilotCode(deps({ ...PILOT, mode: "open" }), { userId: anna, code: CODE })).toEqual({ ok: false, error: "unavailable" });
    expect(await redeemPilotCode(deps({ ...PILOT, mode: "off" }), { userId: anna, code: CODE })).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("admitInvitedPartner", () => {
  test("gives a pass during the pilot without using a place of the limit", async () => {
    await redeemPilotCode(deps(), { userId: anna, code: CODE });
    await redeemPilotCode(deps(), { userId: boris, code: CODE });

    await admitInvitedPartner(deps(), vera);

    expect(await hasPilotPass(db, vera)).toBe(true);
  });

  test("does nothing outside the pilot", async () => {
    await admitInvitedPartner(deps({ ...PILOT, mode: "open" }), vera);
    await admitInvitedPartner(deps({ ...PILOT, mode: "off" }), vera);

    expect(await hasPilotPass(db, vera)).toBe(false);
  });
});

describe("requestJoinAdmitting", () => {
  const togetherDeps = (): TogetherDeps => ({ db, now: () => new Date("2026-10-07T10:00:00Z"), appUrl: "http://localhost:3000" });

  async function inviteOf(userId: string): Promise<string> {
    const outcome = await createTogetherSpace(togetherDeps(), { userId });
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.inviteUrl.split("/").at(-1)!;
  }

  test("an accepted request by a live link gives the partner a pass", async () => {
    const token = await inviteOf(anna);

    expect(await requestJoinAdmitting(deps(), togetherDeps(), { token, userId: boris })).toEqual({ ok: true, status: "requested" });

    expect(await hasPilotPass(db, boris)).toBe(true);
  });

  test("a wrong link, the own link and a person already in a space get no pass", async () => {
    const token = await inviteOf(anna);
    await inviteOf(vera);

    expect(await requestJoinAdmitting(deps(), togetherDeps(), { token: "x".repeat(24), userId: boris })).toEqual({ ok: false, error: "invalid" });
    expect(await requestJoinAdmitting(deps(), togetherDeps(), { token, userId: anna })).toEqual({ ok: false, error: "own_invite" });
    expect(await requestJoinAdmitting(deps(), togetherDeps(), { token, userId: vera })).toEqual({ ok: false, error: "already_in_space" });

    expect(await hasPilotPass(db, boris)).toBe(false);
    expect(await hasPilotPass(db, vera)).toBe(false);
  });

  test("when the feature is open or off, a request creates no pass", async () => {
    const token = await inviteOf(anna);

    await requestJoinAdmitting(deps({ ...PILOT, mode: "open" }), togetherDeps(), { token, userId: boris });

    expect(await hasPilotPass(db, boris)).toBe(false);
  });
});
