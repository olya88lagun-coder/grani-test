import { TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { createTestDb, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import {
  createTogetherSpace,
  getTogetherInvitePreview,
  getTogetherShareUrl,
  getTogetherSpaceView,
  leaveTogether,
  peekTogetherInvite,
  reissueTogetherInvite,
  requestTogetherJoin,
  respondTogetherRequest,
  setTogetherInviteNote,
  type TogetherDeps,
} from "./together-service";

const APP_URL = "http://localhost:3000";
const START = new Date("2026-10-05T10:00:00Z");

let db: Database;
let clock: Date;
let deps: TogetherDeps;
let anna: string;
let boris: string;
let vera: string;

const tokenOf = (inviteUrl: string) => inviteUrl.split("/").at(-1)!;

async function create(userId = anna) {
  const outcome = await createTogetherSpace(deps, { userId });
  if (!outcome.ok) throw new Error(outcome.error);
  return { ...outcome, token: tokenOf(outcome.inviteUrl) };
}

async function makeActive() {
  const { token } = await create();
  await requestTogetherJoin(deps, { token, userId: boris });
  await respondTogetherRequest(deps, { userId: anna, accept: true });
  return token;
}

beforeEach(async () => {
  db = await createTestDb();
  clock = START;
  deps = { db, now: () => clock, appUrl: APP_URL };
  anna = await seedUser(db, { externalId: "anna", displayName: "Аня" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис" });
  vera = await seedUser(db, { externalId: "vera", displayName: "Вера" });
});

describe("createTogetherSpace", () => {
  test("returns an invite link on the site and refuses a second space", async () => {
    const { inviteUrl } = await create();

    expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/together\/invite\/[A-Za-z0-9_-]{24}$/);
    expect(await createTogetherSpace(deps, { userId: anna })).toEqual({ ok: false, error: "already_in_space" });
  });
});

describe("invite flow", () => {
  test("peek tells only whether the link can be used", async () => {
    const { token } = await create();

    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: true });
    expect(await peekTogetherInvite(deps, "nope")).toEqual({ valid: false });
    clock = new Date(START.getTime() + TOGETHER_INVITE_TTL_MS + 1);
    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: false });
  });

  test("the person who asked to join still sees the link as usable after a page refresh", async () => {
    const { token } = await create();
    await requestTogetherJoin(deps, { token, userId: boris });

    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: false });
    expect(await peekTogetherInvite(deps, token, boris)).toEqual({ valid: true });
    expect(await peekTogetherInvite(deps, token, vera)).toEqual({ valid: false });
  });

  test("the inviter sees who asked, confirms, and both then see an active space", async () => {
    const { token } = await create();
    expect(await requestTogetherJoin(deps, { token, userId: boris })).toEqual({ ok: true, status: "requested" });

    expect((await getTogetherSpaceView(deps, anna))?.pendingRequest).toEqual({ displayName: "Борис" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: true })).toEqual({ ok: true, status: "accepted" });

    for (const userId of [anna, boris]) {
      const view = await getTogetherSpaceView(deps, userId);
      expect(view).toMatchObject({ status: "active", pendingRequest: null, members: [{ role: "initiator", displayName: "Аня" }, { role: "partner", displayName: "Борис" }] });
    }
    expect((await getTogetherSpaceView(deps, anna))?.myRole).toBe("initiator");
    expect((await getTogetherSpaceView(deps, boris))?.myRole).toBe("partner");
  });

  test("the requester does not see the request details before confirmation", async () => {
    const { token } = await create();
    await requestTogetherJoin(deps, { token, userId: boris });

    expect(await getTogetherSpaceView(deps, boris)).toBeNull();
  });

  test("maps database refusals to errors and rejects a non-boolean answer", async () => {
    const { token } = await create();

    expect(await requestTogetherJoin(deps, { token, userId: anna })).toEqual({ ok: false, error: "own_invite" });
    expect(await requestTogetherJoin(deps, { token: "x".repeat(24), userId: boris })).toEqual({ ok: false, error: "invalid" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: "yes" })).toEqual({ ok: false, error: "invalid" });
    expect(await respondTogetherRequest(deps, { userId: anna, accept: true })).toEqual({ ok: false, error: "no_request" });
  });

  test("reissue gives a new link and the old one stops working", async () => {
    const { token } = await create();

    const outcome = await reissueTogetherInvite(deps, { userId: anna });

    expect(outcome.ok).toBe(true);
    expect(await peekTogetherInvite(deps, token)).toEqual({ valid: false });
    expect(await reissueTogetherInvite(deps, { userId: vera })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("getTogetherSpaceView", () => {
  test("shows nothing to a person outside the space", async () => {
    await makeActive();

    expect(await getTogetherSpaceView(deps, vera)).toBeNull();
  });

  test("reports zero progress for a pair that has not started", async () => {
    await makeActive();

    expect((await getTogetherSpaceView(deps, anna))?.progress).toEqual({ done: 0, total: 159 });
  });

  test("reports no access before the first payment and allows renewal", async () => {
    await makeActive();

    expect((await getTogetherSpaceView(deps, anna))?.access).toEqual({ active: false, accessUntil: null, stage: 0, canRenew: true });
  });
});

describe("leaveTogether", () => {
  test("requires the acknowledgement of the consequences", async () => {
    await makeActive();

    expect(await leaveTogether(deps, { userId: boris, acknowledged: false })).toEqual({ ok: false, error: "acknowledgement_required" });
    expect(await leaveTogether(deps, { userId: boris, acknowledged: "true" })).toEqual({ ok: false, error: "acknowledgement_required" });
    expect(await getTogetherSpaceView(deps, boris)).not.toBeNull();
  });

  test("closes the space for both without the partner's consent", async () => {
    await makeActive();

    expect(await leaveTogether(deps, { userId: boris, acknowledged: true })).toEqual({ ok: true });

    expect(await getTogetherSpaceView(deps, anna)).toBeNull();
    expect(await getTogetherSpaceView(deps, boris)).toBeNull();
    expect(await leaveTogether(deps, { userId: boris, acknowledged: true })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("invite preview and note", () => {
  test("a usable link shows the inviter's first name, the note and the first question; a wrong link shows nothing", async () => {
    const { token } = await create();
    expect(await setTogetherInviteNote(deps, { userId: anna, note: "  Давай попробуем  " })).toEqual({ ok: true, note: "Давай попробуем" });

    const preview = await getTogetherInvitePreview(deps, token);

    expect(preview).toEqual({ valid: true, inviterName: "Аня", note: "Давай попробуем", firstQuestion: { title: "Замечать хорошее", prompt: expect.any(String) } });
    expect(preview.valid && preview.firstQuestion.prompt.length).toBeGreaterThan(10);
    expect(await getTogetherInvitePreview(deps, "nope")).toEqual({ valid: false });
  });

  test("only the first word of a long display name is shown", async () => {
    const gleb = await seedUser(db, { externalId: "gleb", displayName: "Глеб Петров" });
    const { token } = await create(gleb);

    expect(await getTogetherInvitePreview(deps, token)).toMatchObject({ valid: true, inviterName: "Глеб", note: null });
  });

  test("the note is validated before it is stored", async () => {
    await create();

    expect(await setTogetherInviteNote(deps, { userId: anna, note: 5 })).toEqual({ ok: false, error: "invalid" });
    expect(await setTogetherInviteNote(deps, { userId: anna, note: "я".repeat(201) })).toEqual({ ok: false, error: "too_long" });
    expect(await setTogetherInviteNote(deps, { userId: vera, note: "чужая" })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("share link for friends", () => {
  test("an active pair gets one stable link on the site; a person without an active pair gets not_found", async () => {
    await makeActive();

    const first = await getTogetherShareUrl(deps, { userId: anna });

    expect(first).toEqual({ ok: true, url: expect.stringMatching(/^http:\/\/localhost:3000\/together\?from=[a-z2-9]{10}$/) });
    expect(await getTogetherShareUrl(deps, { userId: boris })).toEqual(first);
    expect(await getTogetherShareUrl(deps, { userId: vera })).toEqual({ ok: false, error: "not_found" });
  });

  test("a space created with the code of another pair can be traced, a bad code does not stop the creation", async () => {
    await makeActive();
    const link = await getTogetherShareUrl(deps, { userId: anna });
    const code = link.ok ? new URL(link.url).searchParams.get("from")! : "";

    expect((await createTogetherSpace(deps, { userId: vera, referredByCode: code })).ok).toBe(true);
    const gleb = await seedUser(db, { externalId: "gleb2", displayName: "Глеб" });
    expect((await createTogetherSpace(deps, { userId: gleb, referredByCode: "not-a-code" })).ok).toBe(true);
  });
});
