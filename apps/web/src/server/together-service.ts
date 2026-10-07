import { TOGETHER_DATE_CARD_IDS, TOGETHER_TRACK } from "@grani/content/together";
import { accessState, canRenew, providedPaidSeconds, stageOf } from "@grani/core";
import {
  closeSpaceForUser,
  countClosedCards,
  countRevealedCards,
  createSpace,
  ensureShareCode,
  getAccessSnapshot,
  getActiveSpaceForUser,
  getPendingRequest,
  hasTogetherConsent,
  peekInvite,
  peekInviteDetails,
  recordTogetherConsent,
  reissueInvite,
  requestJoin,
  respondToRequest,
  setInviteNote,
  type Database,
  type TogetherRole,
} from "@grani/db";
import { LEGAL_VERSIONS } from "../lib/legal";
import { firstName } from "./friends-service";

// Символ NUL и одиночные суррогаты Postgres не принимает: без проверки такой запрос закончился бы ошибкой сервера
const UNSAFE_TEXT = /\u0000|\p{Cs}/u;

export type TogetherDeps = { db: Database; now: () => Date; appUrl: string };
export type TogetherSpaceView = {
  status: "pending" | "active";
  myRole: TogetherRole;
  members: { role: TogetherRole; displayName: string }[];
  pendingRequest: { displayName: string } | null;
  access: { active: boolean; accessUntil: string | null; stage: number; canRenew: boolean };
  progress: { done: number; total: number };
  // Для блока «Вы уже вместе»: дни с подтверждения пары, пройденные вместе разговоры и свидания
  stats: { days: number; conversations: number; dates: number };
};

const inviteUrl = (deps: TogetherDeps, token: string) => new URL(`/together/invite/${token}`, deps.appUrl).toString();

// Согласие на обработку ответов в «Вдвоём» (текущая редакция) нужно до создания пространства и до запроса по ссылке.
// Уже давший его не отвечает снова; согласие, данное вместе с запросом, записывается с версией и временем
async function ensureTogetherConsent(deps: TogetherDeps, userId: string, consent: unknown): Promise<boolean> {
  if (await hasTogetherConsent(deps.db, userId, LEGAL_VERSIONS.consent)) return true;
  if (consent !== true) return false;
  await recordTogetherConsent(deps.db, { userId, version: LEGAL_VERSIONS.consent, at: deps.now() });
  return true;
}

export async function createTogetherSpace(
  deps: TogetherDeps,
  p: { userId: string; referredByCode?: string; consent?: unknown },
): Promise<{ ok: true; spaceId: string; inviteUrl: string } | { ok: false; error: "already_in_space" | "consent_required" }> {
  if (!(await ensureTogetherConsent(deps, p.userId, p.consent))) return { ok: false, error: "consent_required" };
  const outcome = await createSpace(deps.db, { userId: p.userId, now: deps.now(), referredByCode: p.referredByCode });
  return outcome.ok ? { ok: true, spaceId: outcome.spaceId, inviteUrl: inviteUrl(deps, outcome.token) } : { ok: false, error: outcome.reason };
}

// Ссылка для друзей: публичная страница «Вдвоём» с кодом пары. Код ничего не раскрывает о паре
export async function getTogetherShareUrl(deps: TogetherDeps, p: { userId: string }): Promise<{ ok: true; url: string } | { ok: false; error: "not_found" }> {
  const code = await ensureShareCode(deps.db, { userId: p.userId });
  return code ? { ok: true, url: new URL(`/together?from=${code}`, deps.appUrl).toString() } : { ok: false, error: "not_found" };
}

export async function reissueTogetherInvite(
  deps: TogetherDeps,
  p: { userId: string },
): Promise<{ ok: true; inviteUrl: string } | { ok: false; error: "not_found" | "not_pending" }> {
  const outcome = await reissueInvite(deps.db, { userId: p.userId, now: deps.now() });
  return outcome.ok ? { ok: true, inviteUrl: inviteUrl(deps, outcome.token) } : { ok: false, error: outcome.reason };
}

export async function peekTogetherInvite(deps: TogetherDeps, token: string, viewerId?: string): Promise<{ valid: boolean }> {
  return { valid: await peekInvite(deps.db, token, deps.now(), viewerId) };
}

export type InvitePreview = { valid: false } | { valid: true; inviterName: string; note: string | null; firstQuestion: { title: string; prompt: string } };

// Что видит держатель годной ссылки до входа: имя пригласившего (только первое слово), записка и первый вопрос маршрута.
// Остальное о паре по ссылке не раскрывается
export async function getTogetherInvitePreview(deps: TogetherDeps, token: string, viewerId?: string): Promise<InvitePreview> {
  const details = await peekInviteDetails(deps.db, token, deps.now(), viewerId);
  const first = TOGETHER_TRACK[0];
  if (!details || !first) return { valid: false };
  return { valid: true, inviterName: firstName(details.inviterName), note: details.note, firstQuestion: { title: first.title, prompt: first.prompt } };
}

export async function setTogetherInviteNote(
  deps: TogetherDeps,
  p: { userId: string; note: unknown },
): Promise<{ ok: true; note: string | null } | { ok: false; error: "invalid" | "too_long" | "not_found" | "not_pending" }> {
  if (typeof p.note !== "string" || UNSAFE_TEXT.test(p.note)) return { ok: false, error: "invalid" };
  const outcome = await setInviteNote(deps.db, { userId: p.userId, note: p.note });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function requestTogetherJoin(
  deps: TogetherDeps,
  p: { token: string; userId: string; consent?: unknown },
): Promise<{ ok: true; status: "requested" } | { ok: false; error: "invalid" | "own_invite" | "already_in_space" | "consent_required" }> {
  if (!(await ensureTogetherConsent(deps, p.userId, p.consent))) return { ok: false, error: "consent_required" };
  const outcome = await requestJoin(deps.db, { token: p.token, userId: p.userId, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

export async function respondTogetherRequest(
  deps: TogetherDeps,
  p: { userId: string; accept: unknown },
): Promise<{ ok: true; status: "accepted" | "declined" } | { ok: false; error: "invalid" | "not_found" | "no_request" | "requester_unavailable" }> {
  if (typeof p.accept !== "boolean") return { ok: false, error: "invalid" };
  const outcome = await respondToRequest(deps.db, { userId: p.userId, accept: p.accept, now: deps.now() });
  return outcome.ok ? outcome : { ok: false, error: outcome.reason };
}

// Выход без согласия партнёра, но только после того, как человек увидел последствия: клиент присылает acknowledged: true
export async function leaveTogether(
  deps: TogetherDeps,
  p: { userId: string; acknowledged: unknown },
): Promise<{ ok: true } | { ok: false; error: "acknowledgement_required" | "not_found" }> {
  if (p.acknowledged !== true) return { ok: false, error: "acknowledgement_required" };
  const outcome = await closeSpaceForUser(deps.db, { userId: p.userId, now: deps.now(), reason: "left" });
  return outcome.ok ? { ok: true } : { ok: false, error: outcome.reason };
}

const DAY_MS = 86_400_000;

// Дни считаются с подтверждения пары (когда вошёл второй участник); пока пара не собрана, их нет
function daysTogether(snapshot: { space: { status: string }; members: { joinedAt: Date }[] }, now: Date): number {
  if (snapshot.space.status !== "active" || snapshot.members.length < 2) return 0;
  const since = Math.max(...snapshot.members.map((member) => member.joinedAt.getTime()));
  return Math.max(0, Math.floor((now.getTime() - since) / DAY_MS));
}

export async function getTogetherSpaceView(deps: TogetherDeps, userId: string): Promise<TogetherSpaceView | null> {
  const snapshot = await getActiveSpaceForUser(deps.db, userId);
  const me = snapshot?.members.find((member) => member.userId === userId);
  if (!snapshot || !me || snapshot.space.status === "closed") return null;
  const now = deps.now();
  const { periods, closedAt } = await getAccessSnapshot(deps.db, snapshot.space.id);
  const state = accessState(periods, now, closedAt);
  // Запрос на вступление виден только инициатору; имя запросившего — единственное, что ему раскрывается до подтверждения
  const request = me.role === "initiator" ? await getPendingRequest(deps.db, { userId, now }) : null;
  return {
    status: snapshot.space.status,
    myRole: me.role,
    members: snapshot.members.map((member) => ({ role: member.role, displayName: member.displayName })),
    pendingRequest: request ? { displayName: request.displayName } : null,
    access: {
      active: state.active,
      accessUntil: state.accessUntil ? state.accessUntil.toISOString() : null,
      stage: stageOf(providedPaidSeconds(periods, now, closedAt)),
      canRenew: canRenew(periods, now, closedAt),
    },
    progress: { done: await countClosedCards(deps.db, snapshot.space.id), total: TOGETHER_TRACK.length },
    stats: { days: daysTogether(snapshot, now), ...(await countRevealedCards(deps.db, { spaceId: snapshot.space.id, dateCardIds: TOGETHER_DATE_CARD_IDS })) },
  };
}
