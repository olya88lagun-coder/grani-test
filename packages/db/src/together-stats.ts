import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { togetherAnswers, togetherCards } from "./schema";
import type { Database } from "./types";

// Сколько карточек пара прошла вместе: закрыта и ответили оба. Пропущенная карточка и карточка с ответом одного не считаются.
// Свидания считаются отдельно от «разговоров»
export async function countRevealedCards(db: Database, p: { spaceId: string; dateCardIds: ReadonlySet<string> }): Promise<{ conversations: number; dates: number }> {
  const closed = await db
    .select({ id: togetherCards.id, cardId: togetherCards.cardId })
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, p.spaceId), isNotNull(togetherCards.closedAt)));
  if (closed.length === 0) return { conversations: 0, dates: 0 };
  const submitted = await db
    .select({ cardId: togetherAnswers.cardId, userId: togetherAnswers.userId })
    .from(togetherAnswers)
    .where(and(eq(togetherAnswers.spaceId, p.spaceId), inArray(togetherAnswers.cardId, closed.map((row) => row.id)), eq(togetherAnswers.status, "submitted")));
  const authors = new Map<string, Set<string>>();
  for (const row of submitted) authors.set(row.cardId, (authors.get(row.cardId) ?? new Set()).add(row.userId));
  let conversations = 0;
  let dates = 0;
  for (const row of closed) {
    if ((authors.get(row.id)?.size ?? 0) < 2) continue;
    if (p.dateCardIds.has(row.cardId)) dates += 1;
    else conversations += 1;
  }
  return { conversations, dates };
}
