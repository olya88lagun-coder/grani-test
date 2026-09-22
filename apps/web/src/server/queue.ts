import { GENERATE_JOB_OPTIONS, generateJobKey, NOTIFY_JOB_OPTIONS, notifyJobKey, QUEUES, type GenerateJob, type NotifyJob } from "@grani/core";
import { jobIdFor } from "@grani/db";
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

export async function enqueueNotify(job: NotifyJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.notify, job, { ...NOTIFY_JOB_OPTIONS, id: jobIdFor(notifyJobKey(job)) });
  } catch (error) {
    // Действие пользователя уже сохранено; потерянное уведомление не должно его ломать
    console.error("enqueue notify failed", { kind: job.kind, error: String(error) });
  }
}

export async function enqueueGenerate(job: GenerateJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.generate, job, { ...GENERATE_JOB_OPTIONS, id: jobIdFor(generateJobKey(job)) });
  } catch (error) {
    // Оплата уже зафиксирована; страница ожидания поставит задачу заново
    console.error("enqueue generate failed", { kind: job.kind, error: String(error) });
  }
}
