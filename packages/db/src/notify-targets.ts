import { and, eq } from "drizzle-orm";
import { countFriendResponses } from "./invites";
import { authIdentities, invites, results, type AuthProvider } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type NotifyTarget = { provider: AuthProvider; externalId: string };

export async function getNotifyTargets(db: Database, userId: string): Promise<NotifyTarget[]> {
  if (!isUuid(userId)) return [];
  return db
    .select({ provider: authIdentities.provider, externalId: authIdentities.externalId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.canNotify, true)));
}

export async function setCanNotify(db: Database, p: NotifyTarget & { canNotify: boolean }): Promise<void> {
  await db
    .update(authIdentities)
    .set({ canNotify: p.canNotify })
    .where(and(eq(authIdentities.provider, p.provider), eq(authIdentities.externalId, p.externalId)));
}

export async function getFriendAnsweredNotice(
  db: Database,
  inviteId: string,
): Promise<{ ownerUserId: string; resultId: string; friendsCount: number } | null> {
  if (!isUuid(inviteId)) return null;
  const [row] = await db
    .select({ ownerUserId: results.userId, resultId: results.id })
    .from(invites)
    .innerJoin(results, eq(results.id, invites.resultId))
    .where(eq(invites.id, inviteId))
    .limit(1);
  return row ? { ...row, friendsCount: await countFriendResponses(db, inviteId) } : null;
}
