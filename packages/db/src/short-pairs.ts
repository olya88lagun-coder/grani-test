import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import { shortPairInvites, shortPairs, shortTestResults } from "./schema";
import type { ShortResultRecord } from "./short-results";
import { createInviteToken, isInviteToken } from "./tokens";
import type { Database } from "./types";
import { getUser, type UserRecord } from "./users";
import { isUuid } from "./uuid";

export type ShortPairInviteContext = {
  id: string;
  token: string;
  status: "open" | "accepted";
  testSlug: string;
  inviter: UserRecord;
  inviterShortResultId: string;
};
export type ShortPairMember = { user: UserRecord; result: ShortResultRecord };
export type ShortPairRecord = { id: string; testSlug: string; createdAt: Date; members: readonly [ShortPairMember, ShortPairMember] };
export type AcceptShortPairOutcome =
  | { ok: true; pairId: string }
  | { ok: false; reason: "not_found" | "own_invite" | "already_used" | "already_paired" | "wrong_test" };

async function getShortResult(db: Database, id: string): Promise<ShortResultRecord | null> {
  const [row] = await db.select().from(shortTestResults).where(eq(shortTestResults.id, id)).limit(1);
  return row ?? null;
}

// Вызывающий проверяет, что результат принадлежит userId: здесь берётся только тест результата
export async function getOrCreateShortPairInvite(db: Database, p: { userId: string; shortResultId: string }): Promise<{ id: string; token: string }> {
  const [open] = await db
    .select({ id: shortPairInvites.id, token: shortPairInvites.token })
    .from(shortPairInvites)
    .where(and(eq(shortPairInvites.inviterShortResultId, p.shortResultId), eq(shortPairInvites.inviterUserId, p.userId), eq(shortPairInvites.status, "open")))
    .limit(1);
  if (open) return open;
  const result = await getShortResult(db, p.shortResultId);
  if (!result) throw new Error(`Short result ${p.shortResultId} not found`);
  const [created] = await db
    .insert(shortPairInvites)
    .values({ token: createInviteToken(), testSlug: result.testSlug, inviterUserId: p.userId, inviterShortResultId: p.shortResultId })
    .returning({ id: shortPairInvites.id, token: shortPairInvites.token });
  return created!;
}

export async function getShortPairInviteByToken(db: Database, token: string): Promise<ShortPairInviteContext | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await db.select().from(shortPairInvites).where(eq(shortPairInvites.token, token)).limit(1);
  if (!row) return null;
  const inviter = await getUser(db, row.inviterUserId);
  return inviter
    ? { id: row.id, token: row.token, status: row.status, testSlug: row.testSlug, inviter, inviterShortResultId: row.inviterShortResultId }
    : null;
}

export async function getLatestShortResult(db: Database, p: { userId: string; testSlug: string }): Promise<ShortResultRecord | null> {
  if (!isUuid(p.userId)) return null;
  const [row] = await db
    .select()
    .from(shortTestResults)
    .where(and(eq(shortTestResults.userId, p.userId), eq(shortTestResults.testSlug, p.testSlug)))
    .orderBy(desc(shortTestResults.createdAt))
    .limit(1);
  return row ?? null;
}

const activeBetween = (testSlug: string, a: string, b: string) =>
  and(
    isNull(shortPairs.leftAt),
    eq(shortPairs.testSlug, testSlug),
    or(and(eq(shortPairs.userAId, a), eq(shortPairs.userBId, b)), and(eq(shortPairs.userAId, b), eq(shortPairs.userBId, a))),
  );

export async function acceptShortPairInvite(
  db: Database,
  p: { token: string; partnerUserId: string; partnerShortResultId: string; consentAt: Date; consentVersion: string },
): Promise<AcceptShortPairOutcome> {
  const invite = await getShortPairInviteByToken(db, p.token);
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.inviter.id === p.partnerUserId) return { ok: false, reason: "own_invite" };
  if (invite.status !== "open") return { ok: false, reason: "already_used" };
  const partnerResult = await getShortResult(db, p.partnerShortResultId);
  if (!partnerResult || partnerResult.userId !== p.partnerUserId || partnerResult.testSlug !== invite.testSlug) return { ok: false, reason: "wrong_test" };

  return db.transaction(async (tx): Promise<AcceptShortPairOutcome> => {
    const [existing] = await tx.select({ id: shortPairs.id }).from(shortPairs).where(activeBetween(invite.testSlug, invite.inviter.id, p.partnerUserId)).limit(1);
    if (existing) return { ok: false, reason: "already_paired" };
    // Условный UPDATE — единственная точка, где ссылка «сгорает»: второй одновременный запрос ничего не обновит
    const claimed = await tx
      .update(shortPairInvites)
      .set({ status: "accepted" })
      .where(and(eq(shortPairInvites.id, invite.id), eq(shortPairInvites.status, "open")))
      .returning({ id: shortPairInvites.id });
    if (claimed.length === 0) return { ok: false, reason: "already_used" };
    const [pair] = await tx
      .insert(shortPairs)
      .values({
        inviteId: invite.id,
        testSlug: invite.testSlug,
        userAId: invite.inviter.id,
        shortResultAId: invite.inviterShortResultId,
        userBId: p.partnerUserId,
        shortResultBId: p.partnerShortResultId,
        partnerConsentAt: p.consentAt,
        partnerConsentVersion: p.consentVersion,
      })
      .returning({ id: shortPairs.id });
    return { ok: true, pairId: pair!.id };
  });
}

async function loadMember(db: Database, userId: string, resultId: string): Promise<ShortPairMember | null> {
  const [user, result] = await Promise.all([getUser(db, userId), getShortResult(db, resultId)]);
  return user && result ? { user, result } : null;
}

async function loadPair(db: Database, where: SQL | undefined): Promise<ShortPairRecord | null> {
  const [row] = await db.select().from(shortPairs).where(where).limit(1);
  if (!row) return null;
  const [a, b] = await Promise.all([loadMember(db, row.userAId, row.shortResultAId), loadMember(db, row.userBId, row.shortResultBId)]);
  return a && b ? { id: row.id, testSlug: row.testSlug, createdAt: row.createdAt, members: [a, b] } : null;
}

export async function getActiveShortPair(db: Database, pairId: string): Promise<ShortPairRecord | null> {
  if (!isUuid(pairId)) return null;
  return loadPair(db, and(eq(shortPairs.id, pairId), isNull(shortPairs.leftAt)));
}

export async function getShortPairForMember(db: Database, pairId: string, userId: string): Promise<ShortPairRecord | null> {
  if (!isUuid(pairId) || !isUuid(userId)) return null;
  return loadPair(db, and(eq(shortPairs.id, pairId), isNull(shortPairs.leftAt), or(eq(shortPairs.userAId, userId), eq(shortPairs.userBId, userId))));
}

export async function leaveShortPair(db: Database, pairId: string, userId: string): Promise<boolean> {
  if (!isUuid(pairId) || !isUuid(userId)) return false;
  const updated = await db
    .update(shortPairs)
    .set({ leftAt: new Date() })
    .where(and(eq(shortPairs.id, pairId), isNull(shortPairs.leftAt), or(eq(shortPairs.userAId, userId), eq(shortPairs.userBId, userId))))
    .returning({ id: shortPairs.id });
  return updated.length > 0;
}

export async function listActiveShortPairs(db: Database, p: { userId: string; testSlug: string }): Promise<{ id: string; partner: UserRecord; createdAt: Date }[]> {
  if (!isUuid(p.userId)) return [];
  const rows = await db
    .select({ id: shortPairs.id, userAId: shortPairs.userAId, userBId: shortPairs.userBId, createdAt: shortPairs.createdAt })
    .from(shortPairs)
    .where(and(isNull(shortPairs.leftAt), eq(shortPairs.testSlug, p.testSlug), or(eq(shortPairs.userAId, p.userId), eq(shortPairs.userBId, p.userId))))
    .orderBy(desc(shortPairs.createdAt));
  const withPartners = await Promise.all(
    rows.map(async (row) => {
      const partner = await getUser(db, row.userAId === p.userId ? row.userBId : row.userAId);
      return partner ? { id: row.id, partner, createdAt: row.createdAt } : null;
    }),
  );
  return withPartners.filter((pair) => pair !== null);
}
