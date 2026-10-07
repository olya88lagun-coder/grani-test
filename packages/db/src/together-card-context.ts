import { and, asc, count, desc, eq, isNotNull, isNull, ne, notExists, sql } from "drizzle-orm";
import type { AnswerFields, CardSnapshot } from "@grani/core";
import { togetherAnswers, togetherCardMarks, togetherCards, togetherMembers, togetherSpaces, type TogetherAnswerStatus } from "./schema";
import { findActiveMembership, lockSpace } from "./together";
import type { Database } from "./types";
import { isUuid } from "./uuid";

export type CardRow = typeof togetherCards.$inferSelect;
export type CardState = "answer" | "waiting" | "revealed" | "skipped";
export type CardView = {
  id: string;
  position: number;
  total: number;
  snapshot: CardSnapshot;
  state: CardState;
  mine: { fields: AnswerFields; revision: number; done: boolean } | null;
  partner: { status: "none" | "answered" | "skipped"; fields?: AnswerFields; edited?: boolean; done?: boolean };
};
export type SpaceContext = { spaceId: string; partnerId: string };

// Пространство человека: карточками можно пользоваться только в активном пространстве двоих.
// Изменяющие операции берут блокировку пространства: она выстраивает в очередь всё, что делает пара,
// и входит в общий порядок блокировок (пользователь → пространство → …) без блокировки пользователя
export async function resolveSpace(tx: Database, userId: string, options: { lock: boolean } = { lock: true }): Promise<SpaceContext | null> {
  const membership = await findActiveMembership(tx, userId);
  if (!membership) return null;
  const space = options.lock
    ? await lockSpace(tx, membership.spaceId)
    : ((await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, membership.spaceId)).limit(1))[0] ?? null);
  // Статус перечитан после блокировки: пока ждали, человек мог выйти
  if (!space || space.status !== "active") return null;
  const [partner] = await tx
    .select({ userId: togetherMembers.userId })
    .from(togetherMembers)
    .where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt), ne(togetherMembers.userId, userId)))
    .limit(1);
  return partner ? { spaceId: space.id, partnerId: partner.userId } : null;
}

export async function loadCard(tx: Database, spaceId: string, cardId: string): Promise<CardRow | null> {
  if (!isUuid(cardId)) return null;
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.id, cardId), eq(togetherCards.spaceId, spaceId)))
    .limit(1);
  return card ?? null;
}

// Только статусы, без текста: по ним решается, раскрыта ли карточка
export async function answerStatuses(tx: Database, cardId: string): Promise<Map<string, TogetherAnswerStatus>> {
  const rows = await tx.select({ userId: togetherAnswers.userId, status: togetherAnswers.status }).from(togetherAnswers).where(eq(togetherAnswers.cardId, cardId));
  return new Map(rows.map((row) => [row.userId, row.status]));
}

export const isRevealed = (statuses: Map<string, TogetherAnswerStatus>, a: string, b: string): boolean =>
  statuses.get(a) === "submitted" && statuses.get(b) === "submitted";

export async function readAnswer(tx: Database, cardId: string, userId: string): Promise<{ fields: AnswerFields; revision: number } | null> {
  const [row] = await tx
    .select({ fields: togetherAnswers.fields, revision: togetherAnswers.revision })
    .from(togetherAnswers)
    .where(and(eq(togetherAnswers.cardId, cardId), eq(togetherAnswers.userId, userId), eq(togetherAnswers.status, "submitted")))
    .limit(1);
  return row ?? null;
}

// Единственное место, где читается текст ответа партнёра, и только после проверки «у обоих submitted»
export async function buildCardView(tx: Database, p: { card: CardRow; userId: string; partnerId: string; total: number }): Promise<CardView> {
  const statuses = await answerStatuses(tx, p.card.id);
  const mineStatus = statuses.get(p.userId);
  const partnerStatus = statuses.get(p.partnerId);
  const revealed = isRevealed(statuses, p.userId, p.partnerId);
  const marks = await tx.select({ userId: togetherCardMarks.userId, doneAt: togetherCardMarks.doneAt }).from(togetherCardMarks).where(eq(togetherCardMarks.cardId, p.card.id));
  const doneOf = (userId: string) => marks.some((mark) => mark.userId === userId && mark.doneAt !== null);

  const mine = mineStatus === "submitted" ? await readAnswer(tx, p.card.id, p.userId) : null;
  const state: CardState = p.card.closedAt === null ? (mineStatus === "submitted" ? "waiting" : "answer") : revealed ? "revealed" : "skipped";
  const partner: CardView["partner"] = { status: partnerStatus === undefined ? "none" : partnerStatus === "submitted" ? "answered" : "skipped" };
  if (revealed) {
    const theirs = await readAnswer(tx, p.card.id, p.partnerId);
    if (theirs) {
      partner.fields = theirs.fields;
      partner.edited = theirs.revision > 1;
      partner.done = doneOf(p.partnerId);
    }
  }
  return {
    id: p.card.id,
    position: p.card.position,
    total: p.total,
    snapshot: p.card.snapshot,
    state,
    mine: mine ? { fields: mine.fields, revision: mine.revision, done: doneOf(p.userId) } : null,
    partner,
  };
}

export async function openCardOf(tx: Database, spaceId: string): Promise<CardRow | null> {
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(and(eq(togetherCards.spaceId, spaceId), isNull(togetherCards.closedAt)))
    .limit(1);
  return card ?? null;
}

// Закрытая карточка, итог которой человек ещё не посмотрел (нет его отметки); самая ранняя
export async function pendingCardFor(tx: Database, spaceId: string, userId: string): Promise<CardRow | null> {
  const [card] = await tx
    .select()
    .from(togetherCards)
    .where(
      and(
        eq(togetherCards.spaceId, spaceId),
        isNotNull(togetherCards.closedAt),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(togetherCardMarks)
            .where(and(eq(togetherCardMarks.cardId, togetherCards.id), eq(togetherCardMarks.userId, userId))),
        ),
      ),
    )
    .orderBy(asc(togetherCards.position))
    .limit(1);
  return card ?? null;
}

async function openNextCard(tx: Database, spaceId: string, track: readonly CardSnapshot[], now: Date): Promise<CardRow | null> {
  const [last] = await tx.select({ position: togetherCards.position }).from(togetherCards).where(eq(togetherCards.spaceId, spaceId)).orderBy(desc(togetherCards.position)).limit(1);
  const position = (last?.position ?? 0) + 1;
  const next = track[position - 1];
  if (!next) return null;
  const [card] = await tx.insert(togetherCards).values({ spaceId, cardId: next.id, position, snapshot: next, createdAt: now }).returning();
  return card ?? null;
}

// Первая карточка выдаётся при первом обращении пары; повтор ничего не создаёт, пока есть открытая
export async function ensureOpenCard(tx: Database, spaceId: string, track: readonly CardSnapshot[], now: Date): Promise<CardRow | null> {
  return (await openCardOf(tx, spaceId)) ?? (await openNextCard(tx, spaceId, track, now));
}

// Закрытие и выдача следующей карточки — в одной транзакции
export async function closeCard(tx: Database, p: { card: CardRow; track: readonly CardSnapshot[]; now: Date }): Promise<void> {
  await tx.update(togetherCards).set({ closedAt: p.now }).where(eq(togetherCards.id, p.card.id));
  await openNextCard(tx, p.card.spaceId, p.track, p.now);
}

export async function countClosedCards(tx: Database, spaceId: string): Promise<number> {
  const [row] = await tx.select({ value: count() }).from(togetherCards).where(and(eq(togetherCards.spaceId, spaceId), isNotNull(togetherCards.closedAt)));
  return row?.value ?? 0;
}
