export const QUEUES = { notify: "notify" } as const;

export type NotifyJob =
  | { kind: "friend_answered"; inviteId: string; friendsCount: number }
  | { kind: "pair_created"; pairId: string };

// Уведомление — не критичное действие: три попытки с растущей паузой, дальше задача остаётся failed для разбора в логах
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 120 } as const;

export function notifyJobKey(job: NotifyJob): string {
  return job.kind === "friend_answered" ? `friend_answered:${job.inviteId}:${job.friendsCount}` : `pair_created:${job.pairId}`;
}
