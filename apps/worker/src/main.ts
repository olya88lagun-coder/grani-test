import { getLibrary } from "@grani/content/data";
import { NOTIFY_JOB_OPTIONS, notifyJobKey, QUEUES, type GenerateJob, type NotifyJob } from "@grani/core";
import { createDb, jobIdFor } from "@grani/db";
import { Api } from "grammy";
import { PgBoss } from "pg-boss";
import { createWriter } from "./ai";
import { readWorkerEnv } from "./env";
import { runGenerate } from "./generate";
import { log } from "./log";
import { runNotify } from "./notify";
import { dryRunSender, type Senders } from "./senders";
import { createTelegramSender } from "./telegram";
import { createVkSender } from "./vk";

const SHUTDOWN_TIMEOUT_MS = 20_000;

const env = readWorkerEnv();
const db = createDb(env.DATABASE_URL, { maxConnections: env.poolMax });

function buildSenders(): Senders {
  if (env.dryRun) return { telegram: dryRunSender("telegram", log), vk: dryRunSender("vk", log) };
  return {
    ...(env.telegramToken ? { telegram: createTelegramSender(new Api(env.telegramToken)) } : {}),
    ...(env.vkGroupToken ? { vk: createVkSender({ token: env.vkGroupToken, fetchFn: fetch }) } : {}),
  };
}

const senders = buildSenders();
const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: env.poolMax });
boss.on("error", (error) => log("error", "pg-boss error", { error: String(error) }));
await boss.start();
await boss.createQueue(QUEUES.notify);
await boss.createQueue(QUEUES.generate);

const writer = createWriter(env.ai, fetch);
const library = getLibrary();
const enqueueNotify = async (job: NotifyJob) => {
  await boss.send(QUEUES.notify, job, { ...NOTIFY_JOB_OPTIONS, id: jobIdFor(notifyJobKey(job)) });
};

await boss.work<GenerateJob>(QUEUES.generate, async ([job]) => {
  if (!job) return;
  try {
    await runGenerate(job.data, { db, library, writer, log, enqueueNotify });
  } catch (error) {
    log("warn", "generate job failed", { kind: job.data.kind, error: String(error), cause: error instanceof Error ? String(error.cause) : undefined });
    throw error;
  }
});

await boss.work<NotifyJob>(QUEUES.notify, async ([job]) => {
  if (!job) return;
  try {
    await runNotify(job.data, { db, senders, appUrl: env.APP_URL, log });
  } catch (error) {
    // pg-boss пометит задачу для повтора, но в лог контейнера без этого ничего не попадёт
    // У ошибок Drizzle в тексте только запрос, а причина (ECONNRESET, нарушение ограничения) лежит в cause
    log("warn", "notify job failed", { kind: job.data.kind, error: String(error), cause: error instanceof Error ? String(error.cause) : undefined });
    throw error;
  }
});

log("info", "worker started", { telegram: senders.telegram !== undefined, vk: senders.vk !== undefined, dryRun: env.dryRun, ai: env.ai.provider });

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
