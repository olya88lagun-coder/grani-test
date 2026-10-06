import { accessState, type CardSnapshot } from "@grani/core";
import { buildCardView, countClosedCards, ensureOpenCard, openCardOf, pendingCardFor, resolveSpace, type CardView } from "./together-card-context";
import { getAccessSnapshot } from "./together-billing";
import type { Database } from "./types";

export type CurrentCard =
  | { ok: true; card: CardView | null; progress: { done: number; total: number }; accessActive: boolean }
  | { ok: false; reason: "not_found" };

// Что видит человек сейчас: сначала итог, который он ещё не посмотрел, иначе открытая карточка пары.
// Выдача первой карточки — единственная запись при чтении; она идемпотентна под блокировкой пространства
export async function loadCurrentCard(db: Database, p: { userId: string; track: readonly CardSnapshot[]; now: Date }): Promise<CurrentCard> {
  return db.transaction(async (tx): Promise<CurrentCard> => {
    const context = await resolveSpace(tx, p.userId);
    if (!context) return { ok: false, reason: "not_found" };
    await ensureOpenCard(tx, context.spaceId, p.track, p.now);
    const row = (await pendingCardFor(tx, context.spaceId, p.userId)) ?? (await openCardOf(tx, context.spaceId));
    const { periods, closedAt } = await getAccessSnapshot(tx, context.spaceId);
    return {
      ok: true,
      card: row ? await buildCardView(tx, { card: row, userId: p.userId, partnerId: context.partnerId, total: p.track.length }) : null,
      progress: { done: await countClosedCards(tx, context.spaceId), total: p.track.length },
      accessActive: accessState(periods, p.now, closedAt).active,
    };
  });
}
