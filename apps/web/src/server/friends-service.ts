import { compareFriendAnswers, FRIEND_ITEMS, friendItemText } from "@grani/content";
import { friendsReportDue, MIN_FRIENDS, type Answers, type FriendComparison, type GenerateJob, type Gender, type NotifyJob } from "@grani/core";
import {
  addFriendResponse,
  countFriendResponses,
  getInviteByToken,
  getInviteForResult,
  getOrCreateInvite,
  getResultForOwner,
  listFriendAnswers,
  listOwnedProducts,
  type Database,
} from "@grani/db";
import { deviceHash } from "./device";
import { parseAnswersFor } from "./results-service";

export type FriendsDeps = {
  db: Database;
  secret: string;
  enqueueNotify: (job: NotifyJob) => Promise<void>;
  enqueueGenerate: (job: GenerateJob) => Promise<void>;
};
export type FriendsSummary = { inviteToken: string | null; friendsCount: number; needed: number; comparison: FriendComparison | null };
export type FriendPage = { token: string; ownerFirstName: string; ownerGender: Gender; items: readonly { id: string; text: string }[] };
export type FriendSubmitOutcome =
  | { kind: "added"; friendsCount: number }
  | { kind: "duplicate" }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "own_invite" };

const FRIEND_ITEM_IDS: ReadonlySet<string> = new Set(FRIEND_ITEMS.map((item) => item.id));
const FALLBACK_NAME = "Друг";

export function parseFriendAnswers(raw: unknown): Answers | null {
  return parseAnswersFor(FRIEND_ITEM_IDS, raw);
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || FALLBACK_NAME;
}

export async function createInviteForOwner(db: Database, p: { userId: string; resultId: string }): Promise<string | null> {
  const result = await getResultForOwner(db, p.resultId, p.userId);
  return result ? (await getOrCreateInvite(db, result.id)).token : null;
}

export async function getFriendPage(db: Database, token: string): Promise<FriendPage | null> {
  const invite = await getInviteByToken(db, token);
  if (!invite) return null;
  const name = firstName(invite.owner.displayName);
  return {
    token,
    ownerFirstName: name,
    ownerGender: invite.owner.gender,
    items: FRIEND_ITEMS.map((item) => ({ id: item.id, text: friendItemText(item, name) })),
  };
}

export async function submitFriendAnswers(
  deps: FriendsDeps,
  p: { token: string; raw: unknown; deviceId: string; viewerUserId: string | null },
): Promise<FriendSubmitOutcome> {
  const invite = await getInviteByToken(deps.db, p.token);
  if (!invite) return { kind: "not_found" };
  if (p.viewerUserId === invite.owner.id) return { kind: "own_invite" };
  const answers = parseFriendAnswers(p.raw);
  if (!answers) return { kind: "invalid" };

  const stored = await addFriendResponse(deps.db, { inviteId: invite.id, answers, deviceHash: deviceHash(deps.secret, p.deviceId) });
  if (stored === "duplicate") return { kind: "duplicate" };

  const friendsCount = await countFriendResponses(deps.db, invite.id);
  // Ответ уже сохранён: без очереди владелец просто узнает о нём на сайте
  await deps.enqueueNotify({ kind: "friend_answered", inviteId: invite.id, friendsCount }).catch((error: unknown) => {
    console.error("friend notification was not enqueued", { inviteId: invite.id, error: String(error) });
  });
  // Раздел «как меня видят другие» генерируется один раз, когда оплачен полный разбор и ответили трое
  const owned = friendsCount >= MIN_FRIENDS ? await listOwnedProducts(deps.db, { resultId: invite.resultId }) : [];
  if (friendsReportDue(owned, friendsCount)) await deps.enqueueGenerate({ kind: "friends", resultId: invite.resultId });
  return { kind: "added", friendsCount };
}

export async function getFriendsSummary(db: Database, resultId: string): Promise<FriendsSummary> {
  const invite = await getInviteForResult(db, resultId);
  if (!invite) return { inviteToken: null, friendsCount: 0, needed: MIN_FRIENDS, comparison: null };
  const friendAnswers = await listFriendAnswers(db, invite.id);
  const friendsCount = friendAnswers.length;
  const base = { inviteToken: invite.token, friendsCount, needed: Math.max(0, MIN_FRIENDS - friendsCount) };
  if (friendsCount < MIN_FRIENDS) return { ...base, comparison: null };

  const context = await getInviteByToken(db, invite.token);
  if (!context) return { ...base, comparison: null };
  return { ...base, comparison: compareFriendAnswers(context.ownerAnswers, friendAnswers) };
}
