import { buildFriendsInput, buildPairInput, buildPersonalInput, generateReport, type ReportInput, type ReportWriter } from "@grani/ai";
import { compareFriendAnswers, type Library } from "@grani/content";
import { friendsReportDue, type GenerateJob, type NotifyJob } from "@grani/core";
import {
  getActivePair,
  getInviteForResult,
  getReport,
  getResult,
  listFriendAnswers,
  listOwnedProducts,
  saveReport,
  type Database,
  type ReportTarget,
} from "@grani/db";
import type { Logger } from "./log";

export type GenerateDeps = { db: Database; library: Library; writer: ReportWriter | null; log: Logger; enqueueNotify: (job: NotifyJob) => Promise<void> };

const targetOf = (job: GenerateJob): ReportTarget => (job.kind === "pair" ? { pairId: job.pairId } : { resultId: job.resultId });

async function buildInput(job: GenerateJob, deps: GenerateDeps): Promise<ReportInput | null> {
  if (job.kind === "pair") {
    const pair = await getActivePair(deps.db, job.pairId);
    return pair ? buildPairInput(deps.library, pair.members[0].result.scores, pair.members[1].result.scores) : null;
  }
  const result = await getResult(deps.db, job.resultId);
  if (!result) return null;
  if (job.kind !== "friends") return buildPersonalInput(deps.library, job.kind, result);

  // Сайт проверил условия при постановке задачи; проверяем ещё раз — между ними могло пройти время
  const invite = await getInviteForResult(deps.db, result.id);
  const friendAnswers = invite ? await listFriendAnswers(deps.db, invite.id) : [];
  if (!friendsReportDue(await listOwnedProducts(deps.db, { resultId: result.id }), friendAnswers.length)) return null;
  const comparison = compareFriendAnswers(result.answers, friendAnswers);
  return comparison ? buildFriendsInput(result, comparison) : null;
}

export async function runGenerate(job: GenerateJob, deps: GenerateDeps): Promise<void> {
  const target = targetOf(job);
  if (await getReport(deps.db, target, job.kind)) return;
  const input = await buildInput(job, deps);
  if (!input) {
    deps.log("info", "report skipped", { kind: job.kind });
    return;
  }
  const generated = await generateReport(deps.writer, input, { log: (message, extra) => deps.log("warn", message, extra) });
  const { report, created } = await saveReport(deps.db, { target, kind: job.kind, sections: generated.sections, source: generated.source });
  deps.log("info", "report generated", { kind: job.kind, source: generated.source, attempts: generated.attempts, created });
  if (created) await deps.enqueueNotify({ kind: "report_ready", reportId: report.id });
}
