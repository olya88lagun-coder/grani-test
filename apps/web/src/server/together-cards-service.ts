import { TOGETHER_TRACK } from "@grani/content/together";
import type { CardField } from "@grani/core";
import {
  continueCard,
  deleteDraft,
  listHistory,
  loadCurrentCard,
  skipCard,
  submitAnswer,
  type CardState,
  type CardView,
  type HistoryItem,
} from "@grani/db";
import type { TogetherDeps } from "./together-service";

export type CardResponse = {
  id: string;
  position: number;
  kind: "intro" | "main";
  title: string;
  prompt: string;
  hint: string;
  estimatedMinutes: number;
  jointAction: string;
  fields: CardField[];
  state: CardState;
  locked: boolean;
  mine: CardView["mine"];
  partner: CardView["partner"];
};

// Платная карточка закрыта, пока человек ещё не ответил, а доступа нет; уже отвеченное остаётся доступным
function toCardResponse(view: CardView, accessActive: boolean): CardResponse {
  return {
    id: view.id,
    position: view.position,
    kind: view.snapshot.kind,
    title: view.snapshot.title,
    prompt: view.snapshot.prompt,
    hint: view.snapshot.hint,
    estimatedMinutes: view.snapshot.estimatedMinutes,
    jointAction: view.snapshot.jointAction,
    fields: view.snapshot.fields,
    state: view.state,
    locked: view.snapshot.kind === "main" && view.state === "answer" && !accessActive,
    mine: view.mine,
    partner: view.partner,
  };
}

export async function getCurrentTogetherCard(
  deps: TogetherDeps,
  userId: string,
): Promise<{ ok: true; card: CardResponse | null; progress: { done: number; total: number } } | { ok: false; error: "not_found" }> {
  const result = await loadCurrentCard(deps.db, { userId, track: TOGETHER_TRACK, now: deps.now() });
  if (!result.ok) return { ok: false, error: "not_found" };
  return { ok: true, card: result.card ? toCardResponse(result.card, result.accessActive) : null, progress: result.progress };
}

export async function answerTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string; fields: unknown },
): Promise<
  | { ok: true; state: "waiting" | "revealed" | "edited"; revealed: { card: CardResponse } | null }
  | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "access_required" | "invalid_field" | "field_not_available" }
> {
  const outcome = await submitAnswer(deps.db, { userId: p.userId, cardId: p.cardId, fields: p.fields, track: TOGETHER_TRACK, now: deps.now() });
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  return { ok: true, state: outcome.state, revealed: outcome.revealed ? { card: toCardResponse(outcome.revealed, true) } : null };
}

export async function deleteTogetherDraft(
  deps: TogetherDeps,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "already_revealed" }> {
  const outcome = await deleteDraft(deps.db, p);
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function skipTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "already_closed" | "reveal_pending" | "skip_not_allowed" }> {
  const outcome = await skipCard(deps.db, { userId: p.userId, cardId: p.cardId, track: TOGETHER_TRACK, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function continueTogetherCard(
  deps: TogetherDeps,
  p: { userId: string; cardId: string; done: unknown },
): Promise<{ ok: true } | { ok: false; error: "invalid" | "not_found" | "not_closed" }> {
  if (p.done !== undefined && typeof p.done !== "boolean") return { ok: false, error: "invalid" };
  const outcome = await continueCard(deps.db, { userId: p.userId, cardId: p.cardId, done: p.done === true, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function getTogetherHistory(
  deps: TogetherDeps,
  p: { userId: string; before: unknown },
): Promise<{ ok: true; items: HistoryItem[]; next: number | null } | { ok: false; error: "invalid" | "not_found" }> {
  let before: number | undefined;
  if (p.before !== undefined && p.before !== null) {
    const parsed = typeof p.before === "string" && /^\d{1,6}$/.test(p.before) ? Number(p.before) : NaN;
    if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: "invalid" };
    before = parsed;
  }
  const outcome = await listHistory(deps.db, { userId: p.userId, before });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}
