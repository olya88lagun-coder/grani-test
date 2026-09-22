import { createHash } from "node:crypto";
import { NOTIFY_JOB_OPTIONS, notifyJobKey, QUEUES, type NotifyJob } from "@grani/core";
import { PgBoss } from "pg-boss";
import { getEnv } from "./env";

const holder = globalThis as typeof globalThis & { __graniQueue?: Promise<PgBoss> };

function queue(): Promise<PgBoss> {
  holder.__graniQueue ??= (async () => {
    // Только отправка: схему pg-boss и очереди создаёт воркер
    const boss = new PgBoss({ connectionString: getEnv().DATABASE_URL, max: 1, supervise: false, schedule: false, migrate: false });
    boss.on("error", (error) => console.error("queue error", String(error)));
    await boss.start();
    return boss;
  })().catch((error: unknown) => {
    holder.__graniQueue = undefined;
    throw error;
  });
  return holder.__graniQueue;
}

// Одинаковый ключ → одинаковый id задачи: pg-boss не вставит её второй раз
function jobIdFor(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function enqueueNotify(job: NotifyJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.notify, job, { ...NOTIFY_JOB_OPTIONS, id: jobIdFor(notifyJobKey(job)) });
  } catch (error) {
    // Действие пользователя уже сохранено; потерянное уведомление не должно его ломать
    console.error("enqueue notify failed", { kind: job.kind, error: String(error) });
  }
}
