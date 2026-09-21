import type { Gender, NotifyJob } from "@grani/core";
import {
  acceptPairInvite,
  getLatestResultId,
  getOrCreatePairInvite,
  getPairInviteByToken,
  getResultForOwner,
  isInviteToken,
  type Database,
  type UserRecord,
} from "@grani/db";
import { firstName } from "./friends-service";

export type PairsDeps = { db: Database; now: () => Date; enqueueNotify: (job: NotifyJob) => Promise<void> };
export type PairInvitePage =
  | { state: "not_found" }
  | { state: "used"; inviterFirstName: string }
  | { state: "own"; token: string }
  | { state: "needs_login"; inviterFirstName: string; token: string }
  | { state: "needs_result"; inviterFirstName: string; token: string }
  | { state: "ready"; inviterFirstName: string; inviterGender: Gender; token: string };
export type AcceptPairOutcome =
  | { ok: true; pairId: string }
  | { ok: false; error: "consent_required" | "no_result" | "not_found" | "own_invite" | "already_used" | "already_paired" };

export async function createPairInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null> {
  const result = await getResultForOwner(db, p.resultId, p.userId);
  return result ? (await getOrCreatePairInvite(db, { userId: p.userId, resultId: result.id })).token : null;
}

export async function getPairInvitePage(db: Database, token: string, viewer: UserRecord | null): Promise<PairInvitePage> {
  const invite = await getPairInviteByToken(db, token);
  if (!invite) return { state: "not_found" };
  const inviterFirstName = firstName(invite.inviter.displayName);
  if (invite.status !== "open") return { state: "used", inviterFirstName };
  if (viewer?.id === invite.inviter.id) return { state: "own", token };
  if (!viewer) return { state: "needs_login", inviterFirstName, token };
  const resultId = await getLatestResultId(db, viewer.id);
  // Пол пригласившего нужен только для подписи согласия («а я — её/его»)
  return resultId ? { state: "ready", inviterFirstName, inviterGender: invite.inviter.gender, token } : { state: "needs_result", inviterFirstName, token };
}

export async function acceptPair(deps: PairsDeps, p: { token: string; userId: string; consent: boolean }): Promise<AcceptPairOutcome> {
  if (!p.consent) return { ok: false, error: "consent_required" };
  const partnerResultId = await getLatestResultId(deps.db, p.userId);
  if (!partnerResultId) return { ok: false, error: "no_result" };
  const outcome = await acceptPairInvite(deps.db, { token: p.token, partnerUserId: p.userId, partnerResultId, consentAt: deps.now() });
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  // Пара уже создана: без очереди оба узнают о ней на сайте
  await deps.enqueueNotify({ kind: "pair_created", pairId: outcome.pairId }).catch((error: unknown) => {
    console.error("pair notification was not enqueued", { pairId: outcome.pairId, error: String(error) });
  });
  return outcome;
}

export function pairReturnPath(pairCookie: string | null | undefined): string | null {
  return pairCookie && isInviteToken(pairCookie) ? `/p/${pairCookie}` : null;
}
