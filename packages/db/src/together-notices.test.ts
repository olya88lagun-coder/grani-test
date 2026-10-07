import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb, seedUser } from "./testing";
import { closeSpaceForUser, createSpace, reissueInvite, requestJoin, respondToRequest } from "./together";
import { acknowledgeClosedNotice, getClosedNotice, getLiveInviteExpiry } from "./together-notices";
import type { Database } from "./types";

const NOW = new Date("2026-10-07T10:00:00Z");
const DAY_MS = 86_400_000;

let db: Database;
let anna: string;
let boris: string;
let vera: string;

async function makeActive(initiator = anna, partner = boris) {
  const created = await createSpace(db, { userId: initiator, now: NOW });
  if (!created.ok) throw new Error(created.reason);
  await requestJoin(db, { token: created.token, userId: partner, now: NOW });
  await respondToRequest(db, { userId: initiator, accept: true, now: NOW });
  return created.spaceId;
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("closed space notice", () => {
  test("the partner who stayed is told why the space closed, and the one who left is not", async () => {
    const spaceId = await makeActive();
    const closedAt = new Date(NOW.getTime() + DAY_MS);
    await closeSpaceForUser(db, { userId: boris, now: closedAt, reason: "left" });

    expect(await getClosedNotice(db, { userId: anna, now: closedAt })).toEqual({ spaceId, reason: "left", closedAt });
    expect(await getClosedNotice(db, { userId: boris, now: closedAt })).toBeNull();
  });

  test("a deleted account of the partner closes the space with its own reason", async () => {
    await makeActive();
    const closedAt = new Date(NOW.getTime() + DAY_MS);
    await closeSpaceForUser(db, { userId: anna, now: closedAt, reason: "account_deleted" });

    expect(await getClosedNotice(db, { userId: boris, now: closedAt })).toMatchObject({ reason: "account_deleted" });
  });

  test("acknowledging removes the notice, can be repeated, and does nothing for the one who left", async () => {
    await makeActive();
    const closedAt = new Date(NOW.getTime() + DAY_MS);
    await closeSpaceForUser(db, { userId: boris, now: closedAt, reason: "left" });

    await acknowledgeClosedNotice(db, { userId: anna, now: closedAt });
    await acknowledgeClosedNotice(db, { userId: anna, now: closedAt });
    await acknowledgeClosedNotice(db, { userId: boris, now: closedAt });

    expect(await getClosedNotice(db, { userId: anna, now: closedAt })).toBeNull();
  });

  test("an old closure is not shown any more, and a stranger gets nothing", async () => {
    await makeActive();
    const closedAt = new Date(NOW.getTime() + DAY_MS);
    await closeSpaceForUser(db, { userId: boris, now: closedAt, reason: "left" });

    expect(await getClosedNotice(db, { userId: anna, now: new Date(closedAt.getTime() + 29 * DAY_MS) })).not.toBeNull();
    expect(await getClosedNotice(db, { userId: anna, now: new Date(closedAt.getTime() + 31 * DAY_MS) })).toBeNull();
    expect(await getClosedNotice(db, { userId: vera, now: closedAt })).toBeNull();
  });

  test("a space the partner never joined leaves no notice for anybody", async () => {
    await createSpace(db, { userId: anna, now: NOW });
    await closeSpaceForUser(db, { userId: anna, now: NOW, reason: "left" });

    expect(await getClosedNotice(db, { userId: anna, now: NOW })).toBeNull();
    expect(await getClosedNotice(db, { userId: vera, now: NOW })).toBeNull();
  });

  test("the latest closure is the one shown", async () => {
    await makeActive();
    await closeSpaceForUser(db, { userId: boris, now: new Date(NOW.getTime() + DAY_MS), reason: "left" });
    const second = await makeActive(anna, vera);
    const closedAt = new Date(NOW.getTime() + 3 * DAY_MS);
    await closeSpaceForUser(db, { userId: vera, now: closedAt, reason: "account_deleted" });

    expect(await getClosedNotice(db, { userId: anna, now: closedAt })).toEqual({ spaceId: second, reason: "account_deleted", closedAt });
  });
});

describe("getLiveInviteExpiry", () => {
  test("is the end of the live link of the initiator, a new link replaces it, and others have none", async () => {
    await createSpace(db, { userId: anna, now: NOW });

    expect(await getLiveInviteExpiry(db, { userId: anna })).toEqual(new Date(NOW.getTime() + TOGETHER_INVITE_TTL_MS));
    const later = new Date(NOW.getTime() + 3 * DAY_MS);
    await reissueInvite(db, { userId: anna, now: later });
    expect(await getLiveInviteExpiry(db, { userId: anna })).toEqual(new Date(later.getTime() + TOGETHER_INVITE_TTL_MS));
    expect(await getLiveInviteExpiry(db, { userId: boris })).toBeNull();
  });

  test("a link with a waiting request is still live, and an accepted link is not", async () => {
    const created = await createSpace(db, { userId: anna, now: NOW });
    if (!created.ok) throw new Error(created.reason);
    await requestJoin(db, { token: created.token, userId: boris, now: NOW });

    expect(await getLiveInviteExpiry(db, { userId: anna })).not.toBeNull();
    await respondToRequest(db, { userId: anna, accept: true, now: NOW });
    expect(await getLiveInviteExpiry(db, { userId: anna })).toBeNull();
  });
});
