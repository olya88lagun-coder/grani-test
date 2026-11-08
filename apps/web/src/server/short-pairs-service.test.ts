import type { Answer, NotifyJob } from "@grani/core";
import { getShortTest } from "@grani/content/short-tests";
import { createPurchase, createTestDb, getUser, leaveShortPair, markPurchaseSucceeded, seedUser, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { saveShortAnswers } from "./short-results-service";
import {
  acceptShortPair,
  createShortPairInviteForOwner,
  getShortPairInvitePage,
  SHORT_PAIR_CONSENT_VERSION,
  shortPairPage,
} from "./short-pairs-service";

const attachment = getShortTest("attachment")!;
const answersOf = (anxiety: "low" | "high", avoidance: "low" | "high") =>
  Object.fromEntries(attachment.scoring.items.map((i) => [i.id, ((({ anxiety, avoidance })[i.axis as "anxiety" | "avoidance"] === "high") !== i.reverse ? 5 : 1) as Answer]));
const NOW = new Date("2026-11-08T12:00:00Z");

let db: Database;
let anna: string;
let boris: string;
let notify: ReturnType<typeof vi.fn<(job: NotifyJob) => Promise<void>>>;

async function saved(userId: string, anxiety: "low" | "high", avoidance: "low" | "high") {
  const outcome = await saveShortAnswers({ db }, { userId, slug: "attachment", answers: answersOf(anxiety, avoidance) });
  if (!outcome.ok) throw new Error("not saved");
  return outcome.id;
}

const deps = () => ({ db, now: () => NOW, enqueueNotify: notify });

async function pairOf() {
  const token = (await createShortPairInviteForOwner(db, { userId: anna, shortResultId: await saved(anna, "high", "low") }))!;
  await saved(boris, "low", "high");
  const outcome = await acceptShortPair(deps(), { token, userId: boris, consent: true });
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.pairId;
}

beforeEach(async () => {
  db = await createTestDb();
  anna = await seedUser(db, { externalId: "anna", displayName: "Анна Петрова" });
  boris = await seedUser(db, { externalId: "boris", displayName: "Борис Иванов" });
  notify = vi.fn<(job: NotifyJob) => Promise<void>>().mockResolvedValue(undefined);
});

describe("createShortPairInviteForOwner", () => {
  test("creates a token only for an own result", async () => {
    const id = await saved(anna, "high", "low");
    expect(await createShortPairInviteForOwner(db, { userId: anna, shortResultId: id })).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(await createShortPairInviteForOwner(db, { userId: boris, shortResultId: id })).toBeNull();
    expect(await createShortPairInviteForOwner(db, { userId: anna, shortResultId: "nope" })).toBeNull();
  });
});

describe("getShortPairInvitePage", () => {
  test("walks every state of the invite", async () => {
    expect(await getShortPairInvitePage(db, "x".repeat(24), null)).toEqual({ state: "not_found" });
    const token = (await createShortPairInviteForOwner(db, { userId: anna, shortResultId: await saved(anna, "high", "low") }))!;
    const annaUser = (await getUser(db, anna))!;
    const borisUser = (await getUser(db, boris))!;
    expect(await getShortPairInvitePage(db, token, annaUser)).toEqual({ state: "own", token });
    expect(await getShortPairInvitePage(db, token, null)).toEqual({ state: "needs_result", inviterFirstName: "Анна", token, slug: "attachment" });
    expect(await getShortPairInvitePage(db, token, borisUser)).toEqual({ state: "needs_result", inviterFirstName: "Анна", token, slug: "attachment" });
    await saved(boris, "low", "high");
    expect(await getShortPairInvitePage(db, token, borisUser)).toEqual({ state: "ready", inviterFirstName: "Анна", token, slug: "attachment", typeName: "Избегающий тип привязанности" });
    expect((await acceptShortPair(deps(), { token, userId: boris, consent: true })).ok).toBe(true);
    expect(await getShortPairInvitePage(db, token, borisUser)).toEqual({ state: "used", inviterFirstName: "Анна" });
  });
});

describe("acceptShortPair", () => {
  test("needs consent and the partner's own result", async () => {
    const token = (await createShortPairInviteForOwner(db, { userId: anna, shortResultId: await saved(anna, "high", "low") }))!;
    expect(await acceptShortPair(deps(), { token, userId: boris, consent: false })).toEqual({ ok: false, error: "consent_required" });
    expect(await acceptShortPair(deps(), { token, userId: boris, consent: true })).toEqual({ ok: false, error: "no_result" });
    expect(notify).not.toHaveBeenCalled();
  });

  test("creates the pair with the consent version and notifies once", async () => {
    const pairId = await pairOf();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: "short_pair_created", shortPairId: pairId });
    const { shortPairs } = await import("@grani/db/testing");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(shortPairs).where(eq(shortPairs.id, pairId));
    expect(row?.partnerConsentVersion).toBe(SHORT_PAIR_CONSENT_VERSION);
  });

  test("a failed notification does not break the pair", async () => {
    notify.mockRejectedValue(new Error("queue down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await pairOf()).toBeTruthy();
    error.mockRestore();
  });
});

describe("shortPairPage", () => {
  test("shows both members, their combination and the offer to members only", async () => {
    const pairId = await pairOf();
    const page = await shortPairPage(db, { pairId, userId: boris });
    expect(page).toMatchObject({ pairId, me: { firstName: "Борис" }, partner: { firstName: "Анна" }, canBuy: true, report: null, product: "attachment_pair" });
    expect(page?.combination.key).toBe("anxious+avoidant");
    const vera = await seedUser(db, { externalId: "vera" });
    expect(await shortPairPage(db, { pairId, userId: vera })).toBeNull();
  });

  test("opens the report to both once either pays, and hides everything after leaving", async () => {
    const pairId = await pairOf();
    const purchase = await createPurchase(db, { userId: anna, product: "attachment_pair", target: { shortPairId: pairId }, amountKopecks: 34900 });
    await markPurchaseSucceeded(db, purchase.id, NOW);
    for (const userId of [anna, boris]) {
      const page = await shortPairPage(db, { pairId, userId });
      expect(page?.canBuy).toBe(false);
      expect(page?.report?.sections.length).toBeGreaterThan(0);
    }
    await leaveShortPair(db, pairId, anna);
    expect(await shortPairPage(db, { pairId, userId: boris })).toBeNull();
  });

  test("offers the discounted product to a viewer who owns the solo report", async () => {
    const pairId = await pairOf();
    const solo = await createPurchase(db, { userId: boris, product: "attachment_solo", target: { shortResultId: await saved(boris, "low", "high") }, amountKopecks: 19900 });
    await markPurchaseSucceeded(db, solo.id, NOW);
    expect((await shortPairPage(db, { pairId, userId: boris }))?.product).toBe("attachment_pair_discount");
    expect((await shortPairPage(db, { pairId, userId: anna }))?.product).toBe("attachment_pair");
  });
});
