import { compatibilityScore, type NotifyJob } from "@grani/core";
import { getActivePair, getFriendAnsweredNotice, getNotifyTargets, setCanNotify, type Database } from "@grani/db";
import type { Logger } from "./log";
import type { Senders } from "./senders";
import { friendAnsweredText, pairCreatedText } from "./texts";

export type NotifyDeps = { db: Database; senders: Senders; appUrl: string; log: Logger };

const firstWord = (name: string) => name.trim().split(/\s+/)[0] || name;

async function deliver(deps: NotifyDeps, userId: string, text: string): Promise<"sent" | "failed" | "none"> {
  let sent = false;
  let failed = false;
  for (const target of await getNotifyTargets(deps.db, userId)) {
    const send = deps.senders[target.provider];
    if (!send) continue;
    const outcome = await send(target.externalId, text);
    if (outcome === "sent") sent = true;
    if (outcome === "failed") failed = true;
    if (outcome === "rejected") {
      await setCanNotify(deps.db, { ...target, canNotify: false });
      deps.log("warn", "notifications disabled by platform refusal", { provider: target.provider, userId });
    }
  }
  if (sent) return "sent";
  return failed ? "failed" : "none";
}

async function notifyFriendAnswered(deps: NotifyDeps, job: Extract<NotifyJob, { kind: "friend_answered" }>): Promise<boolean> {
  const notice = await getFriendAnsweredNotice(deps.db, job.inviteId);
  if (!notice) return true;
  const url = new URL(`/result/${notice.resultId}`, deps.appUrl).toString();
  return (await deliver(deps, notice.ownerUserId, friendAnsweredText(job.friendsCount, url))) !== "failed";
}

async function notifyPairCreated(deps: NotifyDeps, job: Extract<NotifyJob, { kind: "pair_created" }>): Promise<boolean> {
  const pair = await getActivePair(deps.db, job.pairId);
  if (!pair) return true;
  const [a, b] = pair.members;
  const score = compatibilityScore(a.result.scores, b.result.scores);
  const url = new URL(`/pair/${pair.id}`, deps.appUrl).toString();
  const outcomes = await Promise.all([
    deliver(deps, a.user.id, pairCreatedText(firstWord(b.user.displayName), score, url)),
    deliver(deps, b.user.id, pairCreatedText(firstWord(a.user.displayName), score, url)),
  ]);
  // Повтор задачи отправил бы уведомление и тому, кто его уже получил, поэтому повторяем только когда не ушло никому
  return outcomes.some((outcome) => outcome !== "failed");
}

export async function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void> {
  // report_ready обрабатывается с Task 7 плана 5; до неё такие задачи никто не ставит
  if (job.kind === "report_ready") return;
  const done = job.kind === "friend_answered" ? await notifyFriendAnswered(deps, job) : await notifyPairCreated(deps, job);
  if (!done) throw new Error(`Notification ${job.kind} was not delivered, retry later`);
}
