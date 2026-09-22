import type { Answers } from "@grani/core";
import { count, eq } from "drizzle-orm";
import { friendResponses, invites, results } from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import type { Database } from "./types";
import { getUser, type UserRecord } from "./users";
import { isUuid } from "./uuid";

export type InviteRecord = { id: string; token: string };
export type InviteContext = { id: string; resultId: string; owner: UserRecord; ownerAnswers: Answers };
export type FriendResponseOutcome = "added" | "duplicate";

export async function getInviteForResult(db: Database, resultId: string): Promise<InviteRecord | null> {
  if (!isUuid(resultId)) return null;
  const [row] = await db.select({ id: invites.id, token: invites.token }).from(invites).where(eq(invites.resultId, resultId)).limit(1);
  return row ?? null;
}

export async function getOrCreateInvite(db: Database, resultId: string): Promise<InviteRecord> {
  // Уникальность result_id делает одновременные запросы безопасными: второй просто прочитает первую ссылку
  await db.insert(invites).values({ resultId, token: createInviteToken() }).onConflictDoNothing({ target: invites.resultId });
  const invite = await getInviteForResult(db, resultId);
  if (!invite) throw new Error(`Invite for result ${resultId} was not created`);
  return invite;
}

export async function getInviteByToken(db: Database, token: string): Promise<InviteContext | null> {
  if (!isInviteToken(token)) return null;
  const [row] = await db
    .select({ id: invites.id, resultId: invites.resultId, userId: results.userId, answers: results.answers })
    .from(invites)
    .innerJoin(results, eq(results.id, invites.resultId))
    .where(eq(invites.token, token))
    .limit(1);
  if (!row) return null;
  const owner = await getUser(db, row.userId);
  return owner ? { id: row.id, resultId: row.resultId, owner, ownerAnswers: row.answers as Answers } : null;
}

export async function addFriendResponse(
  db: Database,
  p: { inviteId: string; answers: Answers; deviceHash: string },
): Promise<FriendResponseOutcome> {
  const inserted = await db
    .insert(friendResponses)
    .values(p)
    .onConflictDoNothing({ target: [friendResponses.inviteId, friendResponses.deviceHash] })
    .returning({ id: friendResponses.id });
  return inserted.length > 0 ? "added" : "duplicate";
}

// Отдельные ответы нужны только для подсчёта среднего; наружу из сервиса они не выходят
export async function listFriendAnswers(db: Database, inviteId: string): Promise<Answers[]> {
  const rows = await db.select({ answers: friendResponses.answers }).from(friendResponses).where(eq(friendResponses.inviteId, inviteId));
  return rows.map((row) => row.answers as Answers);
}

export async function countFriendResponses(db: Database, inviteId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(friendResponses).where(eq(friendResponses.inviteId, inviteId));
  return row?.value ?? 0;
}
