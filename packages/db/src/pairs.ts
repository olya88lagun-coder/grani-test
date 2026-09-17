import type { Stability, TraitScores, TypeCode } from "@grani/core";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { type Database } from "./types";
import { pairInvites, pairs, results } from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import { getUser, type UserRecord } from "./users";
import { isUuid } from "./uuid";
import type { InviteRecord } from "./invites";

export type PairInviteContext = { id: string; token: string; status: "open" | "accepted"; inviter: UserRecord; inviterResultId: string };
export type PairResult = { id: string; scores: TraitScores; typeCode: TypeCode; stability: Stability };
export type PairMember = { user: UserRecord; result: PairResult };
export type PairRecord = { id: string; createdAt: Date; members: readonly [PairMember, PairMember] };
export type AcceptOutcome = { ok: true; pairId: string } | { ok: false; reason: "not_found" | "own_invite" | "already_used" | "already_paired" };
export type ActivePair = { id: string; partner: UserRecord; createdAt: Date };

export async function getOrCreatePairInvite(db: Database, p: { userId: string; resultId: string }): Promise<InviteRecord> {
  const [open] = await db
    .select({ id: pairInvites.id, token: pairInvites.token })
    .from(pairInvites)
    .where(and(eq(pairInvites.inviterResultId, p.resultId), eq(pairInvites.inviterUserId, p.userId), eq(pairInvites.status, "open")))
    .limit(1);
  if (open) return open;
  const [created] = await db
    .insert(pairInvites)
    .values({ token: createInviteToken(), inviterUserId: p.userId, inviterResultId: p.resultId })
    .returning({ id: pairInvites.id, token: pairInvites.token });
  return created!;
}

export async function getPairInviteByToken(db: Database, token: string): Promise<PairInviteContext | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await db.select().from(pairInvites).where(eq(pairInvites.token, token)).limit(1);
  if (!row) return null;
  const inviter = await getUser(db, row.inviterUserId);
  return inviter ? { id: row.id, token: row.token, status: row.status, inviter, inviterResultId: row.inviterResultId } : null;
}

const activeBetween = (a: string, b: string) =>
  and(
    isNull(pairs.leftAt),
    or(and(eq(pairs.userAId, a), eq(pairs.userBId, b)), and(eq(pairs.userAId, b), eq(pairs.userBId, a))),
  );

export async function acceptPairInvite(
  db: Database,
  p: { token: string; partnerUserId: string; partnerResultId: string; consentAt: Date },
): Promise<AcceptOutcome> {
  const invite = await getPairInviteByToken(db, p.token);
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.inviter.id === p.partnerUserId) return { ok: false, reason: "own_invite" };
  if (invite.status !== "open") return { ok: false, reason: "already_used" };

  return db.transaction(async (tx): Promise<AcceptOutcome> => {
    const [existing] = await tx.select({ id: pairs.id }).from(pairs).where(activeBetween(invite.inviter.id, p.partnerUserId)).limit(1);
    if (existing) return { ok: false, reason: "already_paired" };
    // Условный UPDATE — единственная точка, где ссылка «сгорает»: второй одновременный запрос ничего не обновит
    const claimed = await tx
      .update(pairInvites)
      .set({ status: "accepted" })
      .where(and(eq(pairInvites.id, invite.id), eq(pairInvites.status, "open")))
      .returning({ id: pairInvites.id });
    if (claimed.length === 0) return { ok: false, reason: "already_used" };
    const [pair] = await tx
      .insert(pairs)
      .values({
        inviteId: invite.id,
        userAId: invite.inviter.id,
        resultAId: invite.inviterResultId,
        userBId: p.partnerUserId,
        resultBId: p.partnerResultId,
        partnerConsentAt: p.consentAt,
      })
      .returning({ id: pairs.id });
    return { ok: true, pairId: pair!.id };
  });
}

async function loadResult(db: Database, resultId: string): Promise<PairResult | null> {
  const [row] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  if (!row) return null;
  return { id: row.id, scores: row.scores as TraitScores, typeCode: row.typeCode as TypeCode, stability: row.stability as Stability };
}

async function loadMember(db: Database, userId: string, resultId: string): Promise<PairMember | null> {
  const [user, result] = await Promise.all([getUser(db, userId), loadResult(db, resultId)]);
  return user && result ? { user, result } : null;
}

export async function getPairForMember(db: Database, pairId: string, userId: string): Promise<PairRecord | null> {
  if (!isUuid(pairId) || !isUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(pairs)
    .where(and(eq(pairs.id, pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .limit(1);
  if (!row) return null;
  const [a, b] = await Promise.all([loadMember(db, row.userAId, row.resultAId), loadMember(db, row.userBId, row.resultBId)]);
  return a && b ? { id: row.id, createdAt: row.createdAt, members: [a, b] } : null;
}

export async function leavePair(db: Database, pairId: string, userId: string): Promise<boolean> {
  if (!isUuid(pairId) || !isUuid(userId)) return false;
  const updated = await db
    .update(pairs)
    .set({ leftAt: new Date() })
    .where(and(eq(pairs.id, pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .returning({ id: pairs.id });
  return updated.length > 0;
}

export async function listActivePairs(db: Database, userId: string): Promise<ActivePair[]> {
  if (!isUuid(userId)) return [];
  const rows = await db
    .select({ id: pairs.id, userAId: pairs.userAId, userBId: pairs.userBId, createdAt: pairs.createdAt })
    .from(pairs)
    .where(and(isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))))
    .orderBy(desc(pairs.createdAt));
  const withPartners = await Promise.all(
    rows.map(async (row) => {
      const partner = await getUser(db, row.userAId === userId ? row.userBId : row.userAId);
      return partner ? { id: row.id, partner, createdAt: row.createdAt } : null;
    }),
  );
  return withPartners.filter((pair): pair is ActivePair => pair !== null);
}
