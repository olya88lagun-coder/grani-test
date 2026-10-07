import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import type { TogetherClosedReason } from "./schema";
import { togetherInvites, togetherMembers, togetherSpaces } from "./schema";
import type { Database } from "./types";

export type ClosedNotice = { spaceId: string; reason: TogetherClosedReason; closedAt: Date };

// Сообщение о закрытии показывается 30 дней: дольше человек уже не ждёт объяснений
const CLOSED_NOTICE_WINDOW_MS = 30 * 86_400_000;

// Пространство, закрытое не самим человеком (партнёр вышел или удалил аккаунт), если человек ещё не отметил, что прочитал.
// Тот, кто закрыл сам, и тот, кто никогда не входил в пространство, сообщения не получает
export async function getClosedNotice(db: Database, p: { userId: string; now: Date }): Promise<ClosedNotice | null> {
  const since = new Date(p.now.getTime() - CLOSED_NOTICE_WINDOW_MS);
  const [row] = await db
    .select({ spaceId: togetherSpaces.id, reason: togetherSpaces.closedReason, closedAt: togetherSpaces.closedAt })
    .from(togetherMembers)
    .innerJoin(togetherSpaces, eq(togetherSpaces.id, togetherMembers.spaceId))
    .where(
      and(
        eq(togetherMembers.userId, p.userId),
        isNull(togetherMembers.closeNoticeSeenAt),
        eq(togetherSpaces.status, "closed"),
        isNotNull(togetherSpaces.closedReason),
        gte(togetherSpaces.closedAt, since),
        or(isNull(togetherSpaces.closedBy), ne(togetherSpaces.closedBy, p.userId)),
      ),
    )
    .orderBy(desc(togetherSpaces.closedAt))
    .limit(1);
  return row && row.reason && row.closedAt ? { spaceId: row.spaceId, reason: row.reason, closedAt: row.closedAt } : null;
}

export async function acknowledgeClosedNotice(db: Database, p: { userId: string; now: Date }): Promise<void> {
  await db
    .update(togetherMembers)
    .set({ closeNoticeSeenAt: p.now })
    .where(and(eq(togetherMembers.userId, p.userId), isNotNull(togetherMembers.leftAt), isNull(togetherMembers.closeNoticeSeenAt)));
}

// Когда заканчивается живая ссылка пригласившего (в том числе уже закончилась, если её не заменили); нет живой ссылки — null
export async function getLiveInviteExpiry(db: Database, p: { userId: string }): Promise<Date | null> {
  const [row] = await db
    .select({ expiresAt: togetherInvites.expiresAt })
    .from(togetherInvites)
    .where(and(eq(togetherInvites.inviterId, p.userId), inArray(togetherInvites.status, ["open", "requested"])))
    .orderBy(desc(togetherInvites.createdAt))
    .limit(1);
  return row?.expiresAt ?? null;
}
