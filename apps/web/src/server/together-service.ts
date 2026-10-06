import { accessState, canRenew, providedPaidSeconds, stageOf } from "@grani/core";
import {
  closeSpaceForUser,
  createSpace,
  getAccessSnapshot,
  getActiveSpaceForUser,
  getPendingRequest,
  peekInvite,
  reissueInvite,
  requestJoin,
  respondToRequest,
  type Database,
  type TogetherRole,
} from "@grani/db";

export type TogetherDeps = { db: Database; now: () => Date; appUrl: string };
export type TogetherSpaceView = {
  status: "pending" | "active";
  myRole: TogetherRole;
  members: { role: TogetherRole; displayName: string }[];
  pendingRequest: { displayName: string } | null;
  access: { active: boolean; accessUntil: string | null; stage: number; canRenew: boolean };
};

const inviteUrl = (deps: TogetherDeps, token: string) => new URL(`/together/invite/${token}`, deps.appUrl).toString();

export async function createTogetherSpace(
  deps: TogetherDeps,
  p: { userId: string },
): Promise<{ ok: true; spaceId: string; inviteUrl: string } | { ok: false; error: "already_in_space" }> {
  const outcome = await createSpace(deps.db, { userId: p.userId, now: deps.now() });
  return outcome.ok ? { ok: true, spaceId: outcome.spaceId, inviteUrl: inviteUrl(deps, outcome.token) } : { ok: false, error: outcome.reason };
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

export async function requestTogetherJoin(
  deps: TogetherDeps,
  p: { token: string; userId: string },
): Promise<{ ok: true; status: "requested" } | { ok: false; error: "invalid" | "own_invite" | "already_in_space" }> {
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
  };
}
