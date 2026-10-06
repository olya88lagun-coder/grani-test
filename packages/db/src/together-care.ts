import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { togetherAnswers, togetherCards } from "./schema";
import { getActiveSpaceForUser } from "./together";
import type { Database } from "./types";

export type CareSources = {
  members: { userId: string; displayName: string }[];
  // Итоговая карточка месяца пройдена: карточка заботы готова к показу
  ready: boolean;
  answers: { cardId: string; userId: string; fields: Record<string, string | boolean> }[];
};

// Что нужно для карточки «Наши способы заботы»: участники активного пространства и присланные ответы закрытых (раскрытых) карточек-источников.
// Ответ открытой карточки не читается: до раскрытия его не видит даже партнёр
export async function loadCareSources(db: Database, p: { userId: string; sourceIds: readonly string[]; readyCardId: string }): Promise<CareSources | null> {
  const snapshot = await getActiveSpaceForUser(db, p.userId);
  if (!snapshot || snapshot.space.status !== "active") return null;
  const spaceId = snapshot.space.id;
  const closed = await db
    .select({ id: togetherCards.id, cardId: togetherCards.cardId })
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, spaceId), isNotNull(togetherCards.closedAt), inArray(togetherCards.cardId, [...p.sourceIds, p.readyCardId])));
  const catalogId = new Map(closed.map((row) => [row.id, row.cardId]));
  const sourceUuids = closed.filter((row) => p.sourceIds.includes(row.cardId)).map((row) => row.id);
  const rows =
    sourceUuids.length === 0
      ? []
      : await db
          .select({ cardId: togetherAnswers.cardId, userId: togetherAnswers.userId, fields: togetherAnswers.fields })
          .from(togetherAnswers)
          .where(and(eq(togetherAnswers.spaceId, spaceId), inArray(togetherAnswers.cardId, sourceUuids), eq(togetherAnswers.status, "submitted")));
  return {
    members: snapshot.members.map((member) => ({ userId: member.userId, displayName: member.displayName })),
    ready: closed.some((row) => row.cardId === p.readyCardId),
    answers: rows.map((row) => ({ cardId: catalogId.get(row.cardId)!, userId: row.userId, fields: row.fields as Record<string, string | boolean> })),
  };
}
