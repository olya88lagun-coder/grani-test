import { accessState, type AnswerFields, type CardSnapshot } from "@grani/core";
import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { togetherAnswers, togetherCardMarks, togetherCards } from "./schema";
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

export type HistoryItem = {
  id: string;
  position: number;
  title: string;
  prompt: string;
  outcome: "revealed" | "skipped";
  mine: { fields: AnswerFields; revision: number } | null;
  partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean };
};

const HISTORY_PAGE = 20;

// Закрытые карточки пространства, новые первыми. Вид строится тем же buildCardView, поэтому ответ партнёра
// попадает сюда только у раскрытых карточек
export async function listHistory(
  db: Database,
  p: { userId: string; before?: number; limit?: number },
): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; reason: "not_found" }> {
  const context = await resolveSpace(db, p.userId, { lock: false });
  if (!context) return { ok: false, reason: "not_found" };
  const limit = p.limit ?? HISTORY_PAGE;
  const rows = await db
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, context.spaceId), isNotNull(togetherCards.closedAt), p.before === undefined ? undefined : lt(togetherCards.position, p.before)))
    .orderBy(desc(togetherCards.position))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items: HistoryItem[] = [];
  for (const row of page) {
    const view = await buildCardView(db, { card: row, userId: p.userId, partnerId: context.partnerId, total: 0 });
    items.push({
      id: view.id,
      position: view.position,
      title: view.snapshot.title,
      prompt: view.snapshot.prompt,
      outcome: view.state === "revealed" ? "revealed" : "skipped",
      mine: view.mine ? { fields: view.mine.fields, revision: view.mine.revision } : null,
      partner: view.partner,
    });
  }
  return { ok: true, items, next: rows.length > limit ? (page.at(-1)?.position ?? null) : null };
}

// Удаление аккаунта: стираются только ответы и отметки этого человека, ответы партнёра остаются у него
export async function deleteUserAnswers(tx: Database, userId: string): Promise<void> {
  await tx.delete(togetherCardMarks).where(eq(togetherCardMarks.userId, userId));
  await tx.delete(togetherAnswers).where(eq(togetherAnswers.userId, userId));
}
