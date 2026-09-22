import { compatibilityScore, type NotifyJob } from "@grani/core";
import { getActivePair, getFriendAnsweredNotice, getNotifyTargets, getReportById, getResult, setCanNotify, type Database } from "@grani/db";
import type { Logger } from "./log";
import type { Senders } from "./senders";
import { chaptersReadyText, friendAnsweredText, pairCreatedText, reportReadyText } from "./texts";

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

async function notifyReportReady(deps: NotifyDeps, job: Extract<NotifyJob, { kind: "report_ready" }>): Promise<boolean> {
  const report = await getReportById(deps.db, job.reportId);
  if (!report) return true;
  if (report.pairId) {
    // Пара могла распасться до уведомления — тогда разбор не виден никому, и сообщать не о чем
    const pair = await getActivePair(deps.db, report.pairId);
    if (!pair) return true;
    const text = reportReadyText(report.kind, new URL(`/pair/${pair.id}`, deps.appUrl).toString());
    const outcomes = await Promise.all(pair.members.map((member) => deliver(deps, member.user.id, text)));
    return outcomes.some((outcome) => outcome !== "failed");
  }
  const result = report.resultId ? await getResult(deps.db, report.resultId) : null;
  if (!result) return true;
  const text = reportReadyText(report.kind, new URL(`/report/${result.id}`, deps.appUrl).toString());
  return (await deliver(deps, result.userId, text)) !== "failed";
}

async function notifyChaptersReady(deps: NotifyDeps, job: Extract<NotifyJob, { kind: "chapters_ready" }>): Promise<boolean> {
  const result = await getResult(deps.db, job.resultId);
  if (!result) return true;
  return (await deliver(deps, result.userId, chaptersReadyText(new URL(`/report/${result.id}`, deps.appUrl).toString()))) !== "failed";
}

export async function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void> {
  const done =
    job.kind === "friend_answered"
      ? await notifyFriendAnswered(deps, job)
      : job.kind === "pair_created"
        ? await notifyPairCreated(deps, job)
        : job.kind === "report_ready"
          ? await notifyReportReady(deps, job)
          : await notifyChaptersReady(deps, job);
  if (!done) throw new Error(`Notification ${job.kind} was not delivered, retry later`);
}
