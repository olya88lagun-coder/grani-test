import { isDeepStrictEqual } from "node:util";
import { accessState, checkAnswerFields, type CardSnapshot } from "@grani/core";
import { and, eq, sql } from "drizzle-orm";
import { togetherAnswers, togetherCardMarks } from "./schema";
import {
  answerStatuses,
  buildCardView,
  closeCard,
  isRevealed,
  loadCard,
  pendingCardFor,
  readAnswer,
  resolveSpace,
  type CardRow,
  type CardView,
  type SpaceContext,
} from "./together-card-context";
import { getAccessSnapshot } from "./together-billing";
import type { Database } from "./types";

export type SubmitOutcome =
  | { ok: true; state: "waiting" | "revealed" | "edited"; revealed: CardView | null }
  | { ok: false; reason: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available"; field?: string };
type Failure<R extends string> = { ok: false; reason: R };

// Общая обвязка: пространство под блокировкой, затем карточка этого пространства; чужой или битый id — not_found
async function inCard<T extends { ok: boolean }>(
  db: Database,
  p: { userId: string; cardId: string },
  run: (tx: Database, context: SpaceContext, card: CardRow) => Promise<T>,
): Promise<T | Failure<"not_found">> {
  return db.transaction(async (tx): Promise<T | Failure<"not_found">> => {
    const context = await resolveSpace(tx, p.userId);
    if (!context) return { ok: false, reason: "not_found" };
    const card = await loadCard(tx, context.spaceId, p.cardId);
    return card ? run(tx, context, card) : { ok: false, reason: "not_found" };
  });
}

async function hasAccess(tx: Database, spaceId: string, now: Date): Promise<boolean> {
  const { periods, closedAt } = await getAccessSnapshot(tx, spaceId);
  return accessState(periods, now, closedAt).active;
}

export async function submitAnswer(
  db: Database,
  p: { userId: string; cardId: string; fields: unknown; track: readonly CardSnapshot[]; now: Date },
): Promise<SubmitOutcome> {
  return inCard<SubmitOutcome>(db, p, async (tx, context, card) => {
    const statuses = await answerStatuses(tx, card.id);
    const mine = statuses.get(p.userId);
    const revealed = isRevealed(statuses, p.userId, context.partnerId);

    if (card.closedAt !== null) {
      // Закрытая карточка: править можно только свой раскрытый ответ
      if (!revealed) return { ok: false, reason: "already_closed" };
      const check = checkAnswerFields(card.snapshot, p.fields, true);
      if (!check.ok) return { ok: false, reason: check.reason, field: check.field };
      const existing = await readAnswer(tx, card.id, p.userId);
      // Ревизия растёт только при настоящем изменении: иначе у партнёра появится ложная отметка «изменено»
      if (existing && !isDeepStrictEqual(existing.fields, check.fields)) {
        // Отметка «изменено» и устаревание выбора для книги — про текст; галочка «в книгу» ревизию не меняет
        const textIds = card.snapshot.fields.filter((field) => field.type === "short_text").map((field) => field.id);
        const textChanged = textIds.some((id) => existing.fields[id] !== check.fields[id]);
        await tx
          .update(togetherAnswers)
          .set({ fields: check.fields, updatedAt: p.now, ...(textChanged ? { revision: sql`${togetherAnswers.revision} + 1` } : {}) })
          .where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId)));
      }
      return { ok: true, state: "edited", revealed: null };
    }

    if (await pendingCardFor(tx, context.spaceId, p.userId)) return { ok: false, reason: "reveal_pending" };
    const check = checkAnswerFields(card.snapshot, p.fields, false);
    if (!check.ok) return { ok: false, reason: check.reason, field: check.field };
    // Платная карточка требует доступа только при первой отправке: правка уже отправленного не блокируется
    if (mine === undefined && card.snapshot.kind === "main" && !(await hasAccess(tx, context.spaceId, p.now))) return { ok: false, reason: "access_required" };

    if (mine === undefined) {
      await tx.insert(togetherAnswers).values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, status: "submitted", fields: check.fields, updatedAt: p.now });
    } else {
      await tx
        .update(togetherAnswers)
        .set({ fields: check.fields, updatedAt: p.now })
        .where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId)));
    }
    if (statuses.get(context.partnerId) !== "submitted") return { ok: true, state: "waiting", revealed: null };

    // Второй ответ раскрывает карточку: она закрывается, следующая выдаётся в той же транзакции
    await closeCard(tx, { card, track: p.track, now: p.now });
    const view = await buildCardView(tx, { card: { ...card, closedAt: p.now }, userId: p.userId, partnerId: context.partnerId, total: p.track.length });
    return { ok: true, state: "revealed", revealed: view };
  });
}

export async function deleteDraft(
  db: Database,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | Failure<"not_found" | "already_closed" | "already_revealed">> {
  return inCard<{ ok: true } | Failure<"already_closed" | "already_revealed">>(db, p, async (tx, context, card) => {
    if (card.closedAt !== null) {
      return { ok: false, reason: isRevealed(await answerStatuses(tx, card.id), p.userId, context.partnerId) ? "already_revealed" : "already_closed" };
    }
    await tx.delete(togetherAnswers).where(and(eq(togetherAnswers.cardId, card.id), eq(togetherAnswers.userId, p.userId), eq(togetherAnswers.status, "submitted")));
    return { ok: true };
  });
}

export async function skipCard(
  db: Database,
  p: { userId: string; cardId: string; track: readonly CardSnapshot[]; now: Date },
): Promise<{ ok: true } | Failure<"not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed" | "access_required">> {
  return inCard<{ ok: true } | Failure<"already_closed" | "reveal_pending" | "skip_not_allowed" | "access_required">>(db, p, async (tx, context, card) => {
    if (card.closedAt !== null) return { ok: false, reason: "already_closed" };
    if (await pendingCardFor(tx, context.spaceId, p.userId)) return { ok: false, reason: "reveal_pending" };
    if (!card.snapshot.skipAllowed) return { ok: false, reason: "skip_not_allowed" };
    // Платную карточку без доступа пропустить нельзя: пропущенное не возвращается, и пара потеряла бы контент до оплаты
    if (card.snapshot.kind === "main" && !(await answerStatuses(tx, card.id)).has(p.userId) && !(await hasAccess(tx, context.spaceId, p.now))) {
      return { ok: false, reason: "access_required" };
    }
    // Свой прежний ответ затирается: пропуск не оставляет текста; ответ партнёра не трогаем и не раскрываем
    await tx
      .insert(togetherAnswers)
      .values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, status: "skipped", fields: {}, updatedAt: p.now })
      .onConflictDoUpdate({ target: [togetherAnswers.cardId, togetherAnswers.userId], set: { status: "skipped", fields: {}, updatedAt: p.now } });
    await tx.insert(togetherCardMarks).values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, seenAt: p.now }).onConflictDoNothing();
    await closeCard(tx, { card, track: p.track, now: p.now });
    return { ok: true };
  });
}

// «Продолжить»: отметка просмотра итога; done добавляется, когда пара сделала действие, и только у раскрытой карточки
export async function continueCard(
  db: Database,
  p: { userId: string; cardId: string; done: boolean; now: Date },
): Promise<{ ok: true } | Failure<"not_found" | "not_closed">> {
  return inCard<{ ok: true } | Failure<"not_closed">>(db, p, async (tx, context, card) => {
    if (card.closedAt === null) return { ok: false, reason: "not_closed" };
    const revealed = isRevealed(await answerStatuses(tx, card.id), p.userId, context.partnerId);
    await tx
      .insert(togetherCardMarks)
      .values({ cardId: card.id, spaceId: context.spaceId, userId: p.userId, seenAt: p.now, doneAt: p.done && revealed ? p.now : null })
      .onConflictDoUpdate({
        target: [togetherCardMarks.cardId, togetherCardMarks.userId],
        set: { doneAt: sql`coalesce(${togetherCardMarks.doneAt}, excluded.done_at)` },
      });
    return { ok: true };
  });
}
