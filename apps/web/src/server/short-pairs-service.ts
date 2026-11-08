import { ATTACHMENT_PAIR_PRODUCTS, pairProductFor, scoreShortTest, type AttachmentPairProduct, type NotifyJob, type ShortTestScore } from "@grani/core";
import { getCombination, getShortTest, type ShortPairCombination, type ShortTestDefinition } from "@grani/content/short-tests";
import { buildShortPairReport, type ShortReport } from "@grani/content/short-tests/report";
import {
  acceptShortPairInvite,
  getLatestShortResult,
  getOrCreateShortPairInvite,
  getShortPairForMember,
  getShortPairInviteByToken,
  getShortResultForOwner,
  hasPaidShortProduct,
  listOwnedProducts,
  type Database,
  type UserRecord,
} from "@grani/db";
import { firstName } from "./friends-service";
import { parseShortAnswers } from "./short-results-service";

// Версия текста согласия партнёра на объединение результатов: меняется вместе с подписью у галочки
export const SHORT_PAIR_CONSENT_VERSION = "2026-11-08-v1";

export type ShortPairsDeps = { db: Database; now: () => Date; enqueueNotify: (job: NotifyJob) => Promise<void> };

export type ShortPairInvitePage =
  | { state: "not_found" }
  | { state: "used"; inviterFirstName: string }
  | { state: "own"; token: string }
  | { state: "needs_result"; inviterFirstName: string; token: string; slug: string }
  | { state: "ready"; inviterFirstName: string; token: string; slug: string; typeName: string };

export type AcceptShortPairResult =
  | { ok: true; pairId: string }
  | { ok: false; error: "consent_required" | "no_result" | "not_found" | "own_invite" | "already_used" | "already_paired" | "wrong_test" };

export async function createShortPairInviteForOwner(db: Database, p: { userId: string; shortResultId: string }): Promise<string | null> {
  const result = await getShortResultForOwner(db, p.shortResultId, p.userId);
  if (!result || !getShortTest(result.testSlug)?.pairOffer) return null;
  return (await getOrCreateShortPairInvite(db, { userId: p.userId, shortResultId: result.id })).token;
}

const typeName = (test: ShortTestDefinition, key: string) => test.types.find((type) => type.key === key)?.name ?? key;

export async function getShortPairInvitePage(db: Database, token: string, viewer: UserRecord | null): Promise<ShortPairInvitePage> {
  const invite = await getShortPairInviteByToken(db, token);
  const test = invite ? getShortTest(invite.testSlug) : null;
  if (!invite || !test) return { state: "not_found" };
  const inviterFirstName = firstName(invite.inviter.displayName);
  if (invite.status !== "open") return { state: "used", inviterFirstName };
  if (viewer?.id === invite.inviter.id) return { state: "own", token };
  const latest = viewer ? await getLatestShortResult(db, { userId: viewer.id, testSlug: invite.testSlug }) : null;
  if (!latest) return { state: "needs_result", inviterFirstName, token, slug: invite.testSlug };
  return { state: "ready", inviterFirstName, token, slug: invite.testSlug, typeName: typeName(test, latest.typeKey) };
}

export async function acceptShortPair(deps: ShortPairsDeps, p: { token: string; userId: string; consent: boolean }): Promise<AcceptShortPairResult> {
  if (!p.consent) return { ok: false, error: "consent_required" };
  const invite = await getShortPairInviteByToken(deps.db, p.token);
  if (!invite) return { ok: false, error: "not_found" };
  // Партнёр объединяет свой последний результат этого теста: тот, что он только что прошёл по ссылке
  const latest = await getLatestShortResult(deps.db, { userId: p.userId, testSlug: invite.testSlug });
  if (!latest) return { ok: false, error: "no_result" };
  const outcome = await acceptShortPairInvite(deps.db, {
    token: p.token,
    partnerUserId: p.userId,
    partnerShortResultId: latest.id,
    consentAt: deps.now(),
    consentVersion: SHORT_PAIR_CONSENT_VERSION,
  });
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  // Пара уже создана: без очереди пригласивший увидит её на сайте
  await deps.enqueueNotify({ kind: "short_pair_created", shortPairId: outcome.pairId }).catch((error: unknown) => {
    console.error("short pair notification was not enqueued", { pairId: outcome.pairId, error: String(error) });
  });
  return outcome;
}

export type ShortPairMemberView = { firstName: string; score: ShortTestScore; typeName: string };
export type ShortPairPage = {
  pairId: string;
  test: ShortTestDefinition;
  me: ShortPairMemberView;
  partner: ShortPairMemberView;
  combination: ShortPairCombination;
  report: ShortReport | null;
  canBuy: boolean;
  product: AttachmentPairProduct;
};

export async function shortPairPage(db: Database, p: { pairId: string; userId: string }): Promise<ShortPairPage | null> {
  const pair = await getShortPairForMember(db, p.pairId, p.userId);
  const test = pair ? getShortTest(pair.testSlug) : null;
  if (!pair || !test?.pairOffer) return null;
  // Баллы пересчитываются из ответов, как у личного результата: пороги могли поменяться
  const views = pair.members.map((member) => {
    const answers = parseShortAnswers(test, member.result.answers);
    if (!answers) return null;
    const score = scoreShortTest(test.scoring, answers);
    return { firstName: firstName(member.user.displayName), score, typeName: typeName(test, score.typeKey) };
  });
  const [a, b] = views;
  if (!a || !b) return null;
  const combination = getCombination(test.slug, a.score.typeKey, b.score.typeKey);
  if (!combination) return null;
  const meIsA = pair.members[0].user.id === p.userId;
  const owned = await listOwnedProducts(db, { shortPairId: pair.id });
  const paid = owned.some((product) => (ATTACHMENT_PAIR_PRODUCTS as readonly string[]).includes(product));
  const hasSolo = await hasPaidShortProduct(db, { userId: p.userId, product: "attachment_solo" });
  return {
    pairId: pair.id,
    test,
    me: meIsA ? a : b,
    partner: meIsA ? b : a,
    combination,
    // Порядок участников в разборе — как в паре: пригласивший первым, у обоих один и тот же текст
    report: paid ? buildShortPairReport(test, { name: a.firstName, score: a.score }, { name: b.firstName, score: b.score }) : null,
    canBuy: !paid,
    product: pairProductFor(hasSolo),
  };
}
