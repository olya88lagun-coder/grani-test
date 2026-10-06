import { createHash } from "node:crypto";
import { TOGETHER_INVITE_NOTE_MAX, TOGETHER_INVITE_TTL_MS } from "@grani/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  togetherInvites,
  togetherMembers,
  togetherSpaces,
  users,
  type TogetherClosedReason,
  type TogetherRole,
  type TogetherSpaceStatus,
} from "./schema";
import { createInviteToken, isInviteToken } from "./tokens";
import type { Database } from "./types";
import { getUser } from "./users";
import { isUuid } from "./uuid";

export type SpaceRecord = { id: string; status: TogetherSpaceStatus; createdAt: Date; closedAt: Date | null; closedReason: TogetherClosedReason | null };
export type MemberRecord = { userId: string; role: TogetherRole; displayName: string; joinedAt: Date };
export type SpaceSnapshot = { space: SpaceRecord; members: MemberRecord[] };
export type PendingRequest = { requesterUserId: string; displayName: string; requestedAt: Date };
export type CreateSpaceOutcome = { ok: true; spaceId: string; token: string } | { ok: false; reason: "already_in_space" };
export type ReissueOutcome = { ok: true; token: string } | { ok: false; reason: "not_found" | "not_pending" };
export type RequestOutcome = { ok: true; status: "requested" } | { ok: false; reason: "invalid" | "own_invite" | "already_in_space" };
export type RespondOutcome = { ok: true; status: "accepted" | "declined" } | { ok: false; reason: "not_found" | "no_request" | "requester_unavailable" };
export type NoteOutcome = { ok: true; note: string | null } | { ok: false; reason: "not_found" | "not_pending" | "too_long" };
export type InvitePreview = { inviterName: string; note: string | null };
export type CloseOutcome = { ok: true; spaceId: string } | { ok: false; reason: "not_found" };

const LIVE_INVITE_STATUSES = ["open", "requested"] as const;

export const hashInviteToken = (token: string): string => createHash("sha256").update(token).digest("hex");

// Порядок блокировок во всех операциях один: пользователь → пространство → приглашение.
// Так одновременные запросы выстраиваются в очередь и не ждут друг друга по кругу
async function lockUser(tx: Database, userId: string): Promise<void> {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
}

export async function lockSpace(tx: Database, spaceId: string) {
  const [space] = await tx.select().from(togetherSpaces).where(eq(togetherSpaces.id, spaceId)).for("update");
  return space ?? null;
}

async function hasActiveMembership(tx: Database, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: togetherMembers.id })
    .from(togetherMembers)
    .where(and(eq(togetherMembers.userId, userId), isNull(togetherMembers.leftAt)))
    .limit(1);
  return row !== undefined;
}

export async function findActiveMembership(tx: Database, userId: string, role?: TogetherRole): Promise<{ spaceId: string } | null> {
  const conditions = [eq(togetherMembers.userId, userId), isNull(togetherMembers.leftAt)];
  if (role) conditions.push(eq(togetherMembers.role, role));
  const [row] = await tx.select({ spaceId: togetherMembers.spaceId }).from(togetherMembers).where(and(...conditions)).limit(1);
  return row ?? null;
}

async function insertOpenInvite(tx: Database, p: { spaceId: string; inviterId: string; now: Date; note?: string | null }): Promise<string> {
  const token = createInviteToken();
  await tx.insert(togetherInvites).values({
    spaceId: p.spaceId,
    tokenHash: hashInviteToken(token),
    inviterId: p.inviterId,
    expiresAt: new Date(p.now.getTime() + TOGETHER_INVITE_TTL_MS),
    note: p.note ?? null,
  });
  return token;
}

async function revokeLiveInvites(tx: Database, spaceId: string): Promise<void> {
  await tx
    .update(togetherInvites)
    .set({ status: "revoked" })
    .where(and(eq(togetherInvites.spaceId, spaceId), inArray(togetherInvites.status, LIVE_INVITE_STATUSES)));
}

async function reopenInvite(tx: Database, inviteId: string): Promise<void> {
  await tx.update(togetherInvites).set({ status: "open", requesterUserId: null, requestedAt: null }).where(eq(togetherInvites.id, inviteId));
}

export async function createSpace(db: Database, p: { userId: string; now: Date }): Promise<CreateSpaceOutcome> {
  return db.transaction(async (tx): Promise<CreateSpaceOutcome> => {
    await lockUser(tx, p.userId);
    if (await hasActiveMembership(tx, p.userId)) return { ok: false, reason: "already_in_space" };
    const [space] = await tx.insert(togetherSpaces).values({ status: "pending" }).returning({ id: togetherSpaces.id });
    await tx.insert(togetherMembers).values({ spaceId: space!.id, userId: p.userId, role: "initiator", joinedAt: p.now });
    const token = await insertOpenInvite(tx, { spaceId: space!.id, inviterId: p.userId, now: p.now });
    return { ok: true, spaceId: space!.id, token };
  });
}

export async function reissueInvite(db: Database, p: { userId: string; now: Date }): Promise<ReissueOutcome> {
  return db.transaction(async (tx): Promise<ReissueOutcome> => {
    await lockUser(tx, p.userId);
    const membership = await findActiveMembership(tx, p.userId, "initiator");
    if (!membership) return { ok: false, reason: "not_found" };
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status !== "pending") return { ok: false, reason: "not_pending" };
    const [live] = await tx
      .select({ note: togetherInvites.note })
      .from(togetherInvites)
      .where(and(eq(togetherInvites.spaceId, space.id), inArray(togetherInvites.status, LIVE_INVITE_STATUSES)))
      .limit(1);
    await revokeLiveInvites(tx, space.id);
    return { ok: true, token: await insertOpenInvite(tx, { spaceId: space.id, inviterId: p.userId, now: p.now, note: live?.note }) };
  });
}

async function findUsableInvite(db: Database, token: string, now: Date, viewerId?: string) {
  if (!isInviteToken(token)) return null;
  const [invite] = await db.select().from(togetherInvites).where(eq(togetherInvites.tokenHash, hashInviteToken(token))).limit(1);
  if (!invite || invite.expiresAt <= now) return null;
  if (invite.status === "open") return invite;
  return invite.status === "requested" && viewerId !== undefined && invite.requesterUserId === viewerId ? invite : null;
}

// Проверка ссылки: годна открытая и непросроченная; причину отказа не раскрываем.
// Для вошедшего человека, уже отправившего запрос по этой ссылке, она остаётся годной: после обновления страницы он видит своё ожидание
export async function peekInvite(db: Database, token: string, now: Date, viewerId?: string): Promise<boolean> {
  return (await findUsableInvite(db, token, now, viewerId)) !== null;
}

// Что видит держатель годной ссылки: имя пригласившего и записка. Для негодной ссылки — null, как и в peekInvite
export async function peekInviteDetails(db: Database, token: string, now: Date, viewerId?: string): Promise<InvitePreview | null> {
  const invite = await findUsableInvite(db, token, now, viewerId);
  if (!invite) return null;
  const inviter = await getUser(db, invite.inviterId);
  return inviter ? { inviterName: inviter.displayName, note: invite.note } : null;
}

// Записку можно менять, пока пространство ждёт партнёра. Пустая записка стирает прежнюю
export async function setInviteNote(db: Database, p: { userId: string; note: string }): Promise<NoteOutcome> {
  const note = p.note.trim();
  if ([...note].length > TOGETHER_INVITE_NOTE_MAX) return { ok: false, reason: "too_long" };
  return db.transaction(async (tx): Promise<NoteOutcome> => {
    await lockUser(tx, p.userId);
    const membership = await findActiveMembership(tx, p.userId, "initiator");
    if (!membership) return { ok: false, reason: "not_found" };
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status !== "pending") return { ok: false, reason: "not_pending" };
    const value = note === "" ? null : note;
    await tx
      .update(togetherInvites)
      .set({ note: value })
      .where(and(eq(togetherInvites.spaceId, space.id), inArray(togetherInvites.status, LIVE_INVITE_STATUSES)));
    return { ok: true, note: value };
  });
}

export async function requestJoin(db: Database, p: { token: string; userId: string; now: Date }): Promise<RequestOutcome> {
  if (!isInviteToken(p.token)) return { ok: false, reason: "invalid" };
  return db.transaction(async (tx): Promise<RequestOutcome> => {
    await lockUser(tx, p.userId);
    const [invite] = await tx.select().from(togetherInvites).where(eq(togetherInvites.tokenHash, hashInviteToken(p.token))).for("update");
    if (!invite || (invite.status !== "open" && invite.status !== "requested") || invite.expiresAt <= p.now) return { ok: false, reason: "invalid" };
    if (invite.inviterId === p.userId) return { ok: false, reason: "own_invite" };
    if (invite.status === "requested") return invite.requesterUserId === p.userId ? { ok: true, status: "requested" } : { ok: false, reason: "invalid" };
    if (await hasActiveMembership(tx, p.userId)) return { ok: false, reason: "already_in_space" };
    await tx.update(togetherInvites).set({ status: "requested", requesterUserId: p.userId, requestedAt: p.now }).where(eq(togetherInvites.id, invite.id));
    return { ok: true, status: "requested" };
  });
}

export async function getPendingRequest(db: Database, p: { userId: string; now: Date }): Promise<PendingRequest | null> {
  const membership = await findActiveMembership(db, p.userId, "initiator");
  if (!membership) return null;
  const [invite] = await db
    .select()
    .from(togetherInvites)
    .where(and(eq(togetherInvites.spaceId, membership.spaceId), eq(togetherInvites.status, "requested")))
    .limit(1);
  if (!invite?.requesterUserId || !invite.requestedAt || invite.expiresAt <= p.now) return null;
  const requester = await getUser(db, invite.requesterUserId);
  return requester ? { requesterUserId: requester.id, displayName: requester.displayName, requestedAt: invite.requestedAt } : null;
}

async function requesterCanJoin(tx: Database, requesterId: string): Promise<boolean> {
  const [user] = await tx.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, requesterId)).limit(1);
  return user !== undefined && user.deletedAt === null && !(await hasActiveMembership(tx, requesterId));
}

export async function respondToRequest(db: Database, p: { userId: string; accept: boolean; now: Date }): Promise<RespondOutcome> {
  return db.transaction(async (tx): Promise<RespondOutcome> => {
    const membership = await findActiveMembership(tx, p.userId, "initiator");
    if (!membership) return { ok: false, reason: "not_found" };
    const [seen] = await tx
      .select()
      .from(togetherInvites)
      .where(and(eq(togetherInvites.spaceId, membership.spaceId), eq(togetherInvites.status, "requested")))
      .limit(1);
    if (!seen?.requesterUserId) return { ok: false, reason: "no_request" };
    const requesterId = seen.requesterUserId;
    // Блокируем в общем порядке: запросивший → пространство → приглашение, затем перечитываем состояние
    await lockUser(tx, requesterId);
    const space = await lockSpace(tx, membership.spaceId);
    const [invite] = await tx.select().from(togetherInvites).where(eq(togetherInvites.id, seen.id)).for("update");
    if (!space || space.status !== "pending") return { ok: false, reason: "no_request" };
    if (!invite || invite.status !== "requested" || invite.requesterUserId !== requesterId || invite.expiresAt <= p.now) return { ok: false, reason: "no_request" };
    if (!p.accept) {
      await reopenInvite(tx, invite.id);
      return { ok: true, status: "declined" };
    }
    if (!(await requesterCanJoin(tx, requesterId))) {
      await reopenInvite(tx, invite.id);
      return { ok: false, reason: "requester_unavailable" };
    }
    await tx.insert(togetherMembers).values({ spaceId: space.id, userId: requesterId, role: "partner", joinedAt: p.now });
    await tx.update(togetherSpaces).set({ status: "active" }).where(eq(togetherSpaces.id, space.id));
    await tx.update(togetherInvites).set({ status: "accepted", confirmedAt: p.now }).where(eq(togetherInvites.id, invite.id));
    return { ok: true, status: "accepted" };
  });
}

export async function closeSpaceForUser(db: Database, p: { userId: string; now: Date; reason: TogetherClosedReason }): Promise<CloseOutcome> {
  return db.transaction(async (tx): Promise<CloseOutcome> => {
    await lockUser(tx, p.userId);
    const membership = await findActiveMembership(tx, p.userId);
    if (!membership) return { ok: false, reason: "not_found" };
    const space = await lockSpace(tx, membership.spaceId);
    if (!space || space.status === "closed") return { ok: false, reason: "not_found" };
    await tx
      .update(togetherSpaces)
      .set({ status: "closed", closedAt: p.now, closedBy: p.userId, closedReason: p.reason })
      .where(eq(togetherSpaces.id, space.id));
    // Оба участника освобождаются: в закрытом пространстве активных нет
    await tx.update(togetherMembers).set({ leftAt: p.now }).where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt)));
    await revokeLiveInvites(tx, space.id);
    return { ok: true, spaceId: space.id };
  });
}

export async function getActiveSpaceForUser(db: Database, userId: string): Promise<SpaceSnapshot | null> {
  if (!isUuid(userId)) return null;
  const membership = await findActiveMembership(db, userId);
  if (!membership) return null;
  const [space] = await db.select().from(togetherSpaces).where(eq(togetherSpaces.id, membership.spaceId)).limit(1);
  if (!space || space.status === "closed") return null;
  const rows = await db
    .select()
    .from(togetherMembers)
    .where(and(eq(togetherMembers.spaceId, space.id), isNull(togetherMembers.leftAt)))
    .orderBy(asc(togetherMembers.joinedAt), asc(togetherMembers.role));
  const members = await Promise.all(
    rows.map(async (row): Promise<MemberRecord | null> => {
      const user = await getUser(db, row.userId);
      return user ? { userId: row.userId, role: row.role, displayName: user.displayName, joinedAt: row.joinedAt } : null;
    }),
  );
  return {
    space: { id: space.id, status: space.status, createdAt: space.createdAt, closedAt: space.closedAt, closedReason: space.closedReason },
    members: members.filter((member): member is MemberRecord => member !== null),
  };
}
