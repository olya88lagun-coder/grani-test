import type { ReportKind } from "./reports";

export const QUEUES = { notify: "notify", generate: "generate" } as const;

export type NotifyJob =
  | { kind: "friend_answered"; inviteId: string; friendsCount: number }
  | { kind: "pair_created"; pairId: string }
  | { kind: "report_ready"; reportId: string }
  // Набор из четырёх глав объявляется одним сообщением, когда готова последняя
  | { kind: "chapters_ready"; resultId: string };

export type GenerateJob = { kind: Exclude<ReportKind, "pair">; resultId: string } | { kind: "pair"; pairId: string };

// Уведомление — не критичное действие: три попытки с растущей паузой, дальше задача остаётся failed для разбора в логах
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 120 } as const;
// Внутри задачи уже три попытки модели по 60 с и сборка из блоков; повтор pg-boss нужен только при сбое базы
export const GENERATE_JOB_OPTIONS = { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 600 } as const;

export function notifyJobKey(job: NotifyJob): string {
  if (job.kind === "friend_answered") return `friend_answered:${job.inviteId}:${job.friendsCount}`;
  if (job.kind === "pair_created") return `pair_created:${job.pairId}`;
  if (job.kind === "report_ready") return `report_ready:${job.reportId}`;
  return `chapters_ready:${job.resultId}`;
}

export function generateJobKey(job: GenerateJob): string {
  return `generate:${job.kind === "pair" ? job.pairId : job.resultId}:${job.kind}`;
}
