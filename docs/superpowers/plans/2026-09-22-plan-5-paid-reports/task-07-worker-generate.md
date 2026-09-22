# Task 7: Воркер — очередь `generate`, сохранение разбора, уведомление «разбор готов»

**Files:**
- Create: `packages/db/src/job-id.ts`, `job-id.test.ts`
- Modify: `packages/db/src/index.ts`, `apps/web/src/server/queue.ts` (общий `jobIdFor`)
- Create: `apps/worker/src/ai.ts`, `ai.test.ts`, `apps/worker/src/generate.ts`, `generate.test.ts`
- Modify: `apps/worker/package.json`, `apps/worker/src/env.ts`, `env.test.ts`, `apps/worker/src/texts.ts`, `texts.test.ts`, `apps/worker/src/notify.ts`, `notify.test.ts`, `apps/worker/src/main.ts`

**Interfaces:**
- Consumes: `generateReport`, `buildPersonalInput`, `buildFriendsInput`, `buildPairInput`, `createYandexWriter`, `createGigaChatWriter`, `ReportWriter` (Tasks 3–4); `saveReport`, `getReport`, `getReportById`, `getResult`, `listOwnedProducts`, `getActivePair`, `getInviteForResult`, `listFriendAnswers` (Task 2, план 4); `compareFriendAnswers` (Task 1); `GenerateJob`, `NotifyJob`, `QUEUES`, `GENERATE_JOB_OPTIONS`, `NOTIFY_JOB_OPTIONS`, `notifyJobKey`, `friendsReportDue`, `ReportKind` (`@grani/core`).
- Produces:
  ```ts
  // packages/db/src/job-id.ts
  function jobIdFor(key: string): string;   // uuid из sha256 ключа — pg-boss не вставит задачу дважды

  // apps/worker/src/env.ts
  type AiConfig = { provider: "none" } | { provider: "yandex"; apiKey: string; folderId: string } | { provider: "gigachat"; authKey: string; scope: string };
  type WorkerEnv = … & { ai: AiConfig };

  // apps/worker/src/ai.ts
  function createWriter(config: AiConfig, fetchFn: typeof fetch): ReportWriter | null;

  // apps/worker/src/generate.ts
  type GenerateDeps = { db: Database; library: Library; writer: ReportWriter | null; log: Logger; enqueueNotify: (job: NotifyJob) => Promise<void> };
  function runGenerate(job: GenerateJob, deps: GenerateDeps): Promise<void>;

  // apps/worker/src/texts.ts
  function reportReadyText(kind: ReportKind, url: string): string;
  ```

Задача `generate` идемпотентна на всех уровнях: id задачи выводится из `generateJobKey`, воркер сначала проверяет, нет ли уже разбора, а `saveReport` при гонке возвращает существующий с `created: false`. Уведомление `report_ready` ставится только при `created: true`.

Воркер повторно проверяет условия, которые проверил сайт: раздел друзей — только при оплаченном полном разборе и не меньше трёх ответов; разбор пары — только для активной пары (если пара распалась до генерации, задача ничего не делает). Имени и пола во входе модели нет — это обеспечивают построители входа из Task 3.

Уведомление «готово»: личные разборы — владельцу результата, ссылка `/report/<resultId>`; разбор пары — обоим участникам активной пары, ссылка `/pair/<pairId>`. Текст без родовых окончаний: «Готово: глава «Деньги». Открыть: …».

ИИ выбирается переменной `AI_PROVIDER` (`none` — по умолчанию, `yandex`, `gigachat`); для выбранного провайдера нужны его ключи, иначе воркер не стартует.

- [ ] **Step 1: Общий id задачи**

`packages/db/src/job-id.test.ts`:
```ts
import { expect, test } from "vitest";
import { jobIdFor } from "./job-id";

test("the same key gives the same uuid-shaped job id", () => {
  expect(jobIdFor("generate:r1:full")).toBe(jobIdFor("generate:r1:full"));
  expect(jobIdFor("generate:r1:full")).not.toBe(jobIdFor("generate:r1:friends"));
  expect(jobIdFor("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});
```

`packages/db/src/job-id.ts`:
```ts
import { createHash } from "node:crypto";

// Одинаковый ключ → одинаковый id задачи: pg-boss не вставит её второй раз. Нужен и сайту, и воркеру
export function jobIdFor(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
```

В `packages/db/src/index.ts` добавить `export * from "./job-id";`. В `apps/web/src/server/queue.ts` удалить локальную `jobIdFor` и импорт `createHash`, импортировать `jobIdFor` из `@grani/db`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/db/src/job-id.test.ts
```
Expected: PASS.

- [ ] **Step 2: Пакет воркера**

В `apps/worker/package.json` в `dependencies` добавить `"@grani/ai": "workspace:*"` и `"@grani/content": "workspace:*"`.

```bash
pnpm install && pnpm dedupe
```

- [ ] **Step 3: Тесты окружения, выбора модели и текстов (падают)**

В `apps/worker/src/env.test.ts` во всех ожиданиях `toEqual` полного окружения добавить `ai: { provider: "none" }`; дописать:
```ts
test("reads the AI provider with its keys", () => {
  expect(readWorkerEnv({ ...BASE, AI_PROVIDER: "yandex", YANDEX_API_KEY: "key", YANDEX_FOLDER_ID: "b1g" }).ai).toEqual({ provider: "yandex", apiKey: "key", folderId: "b1g" });
  expect(readWorkerEnv({ ...BASE, AI_PROVIDER: "gigachat", GIGACHAT_AUTH_KEY: "auth" }).ai).toEqual({ provider: "gigachat", authKey: "auth", scope: "GIGACHAT_API_PERS" });
  expect(() => readWorkerEnv({ ...BASE, AI_PROVIDER: "yandex", YANDEX_API_KEY: "key" })).toThrow(/YANDEX_FOLDER_ID/);
  expect(() => readWorkerEnv({ ...BASE, AI_PROVIDER: "gigachat" })).toThrow(/GIGACHAT_AUTH_KEY/);
});
```

`apps/worker/src/ai.test.ts`:
```ts
import { expect, test, vi } from "vitest";
import { createWriter } from "./ai";

test("creates the writer of the configured provider", () => {
  const fetchFn = vi.fn();

  expect(createWriter({ provider: "none" }, fetchFn)).toBeNull();
  expect(createWriter({ provider: "yandex", apiKey: "k", folderId: "f" }, fetchFn)?.name).toBe("yandexgpt");
  expect(createWriter({ provider: "gigachat", authKey: "a", scope: "s" }, fetchFn)?.name).toBe("gigachat");
});
```

В `apps/worker/src/texts.test.ts` дописать:
```ts
test("a ready report names what is ready without gender endings", () => {
  expect(reportReadyText("full", "https://grani-test.ru/report/1")).toBe("Готово: полный разбор. Открыть: https://grani-test.ru/report/1");
  expect(reportReadyText("chapter_money", "u")).toBe("Готово: глава «Деньги». Открыть: u");
  expect(reportReadyText("friends", "u")).toBe("Готово: раздел «Как тебя видят другие». Открыть: u");
  expect(reportReadyText("pair", "u")).toBe("Готово: разбор вашей пары. Открыть: u");
});
```
и `reportReadyText` в импорт.

```bash
pnpm vitest run apps/worker
```
Expected: FAIL — нет `./ai`, `reportReadyText`, поля `ai`.

- [ ] **Step 4: Окружение, выбор модели, тексты**

В `apps/worker/src/env.ts`:
- в схему:
  ```ts
  AI_PROVIDER: z.enum(["none", "yandex", "gigachat"]).default("none"),
  YANDEX_API_KEY: z.string().min(1).optional(),
  YANDEX_FOLDER_ID: z.string().min(1).optional(),
  GIGACHAT_AUTH_KEY: z.string().min(1).optional(),
  GIGACHAT_SCOPE: z.string().min(1).default("GIGACHAT_API_PERS"),
  ```
- тип и сборку:
  ```ts
  export type AiConfig = { provider: "none" } | { provider: "yandex"; apiKey: string; folderId: string } | { provider: "gigachat"; authKey: string; scope: string };

  function readAi(env: z.infer<typeof schema>): AiConfig {
    if (env.AI_PROVIDER === "yandex") {
      const missing = [!env.YANDEX_API_KEY && "YANDEX_API_KEY", !env.YANDEX_FOLDER_ID && "YANDEX_FOLDER_ID"].filter(Boolean);
      if (missing.length > 0) throw new Error(`Invalid worker environment variables: ${missing.join(", ")}`);
      return { provider: "yandex", apiKey: env.YANDEX_API_KEY!, folderId: env.YANDEX_FOLDER_ID! };
    }
    if (env.AI_PROVIDER === "gigachat") {
      if (!env.GIGACHAT_AUTH_KEY) throw new Error("Invalid worker environment variables: GIGACHAT_AUTH_KEY");
      return { provider: "gigachat", authKey: env.GIGACHAT_AUTH_KEY, scope: env.GIGACHAT_SCOPE };
    }
    return { provider: "none" };
  }
  ```
- `WorkerEnv` дополнить `ai: AiConfig`, в возвращаемый объект — `ai: readAi(env)`.

`apps/worker/src/ai.ts`:
```ts
import { createGigaChatWriter, createYandexWriter, type ReportWriter } from "@grani/ai";
import type { AiConfig } from "./env";

// Без провайдера разборы собираются из блоков — так работает локальная разработка
export function createWriter(config: AiConfig, fetchFn: typeof fetch): ReportWriter | null {
  if (config.provider === "yandex") return createYandexWriter({ apiKey: config.apiKey, folderId: config.folderId, fetchFn });
  if (config.provider === "gigachat") return createGigaChatWriter({ authKey: config.authKey, scope: config.scope, fetchFn });
  return null;
}
```

В `apps/worker/src/texts.ts`:
```ts
import type { ReportKind } from "@grani/core";

const READY_TITLES: Readonly<Record<ReportKind, string>> = {
  full: "полный разбор",
  friends: "раздел «Как тебя видят другие»",
  chapter_money: "глава «Деньги»",
  chapter_conflict: "глава «Конфликты»",
  chapter_stress: "глава «Стресс»",
  chapter_relationships: "глава «Отношения»",
  pair: "разбор вашей пары",
};

export function reportReadyText(kind: ReportKind, url: string): string {
  return `Готово: ${READY_TITLES[kind]}. Открыть: ${url}`;
}
```
(импорт `ReportKind` — к существующим импортам файла).

```bash
pnpm vitest run apps/worker/src/env.test.ts apps/worker/src/ai.test.ts apps/worker/src/texts.test.ts
```
Expected: PASS.

- [ ] **Step 5: Тесты генерации и уведомления (падают)**

`apps/worker/src/generate.test.ts`:
```ts
import { FRIEND_ITEMS } from "@grani/content";
import { getLibrary } from "@grani/content/data";
import {
  addFriendResponse,
  createPurchase,
  createTestDb,
  getOrCreateInvite,
  getReport,
  leavePair,
  markPurchaseSucceeded,
  seedPair,
  seedUserWithResult,
  type Database,
} from "@grani/db/testing";
import { fallbackSections, buildPersonalInput } from "@grani/ai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runGenerate, type GenerateDeps } from "./generate";

let db: Database;
let deps: GenerateDeps;
let anna: { userId: string; resultId: string };

beforeEach(async () => {
  db = await createTestDb();
  deps = { db, library: getLibrary(), writer: null, log: vi.fn(), enqueueNotify: vi.fn().mockResolvedValue(undefined) };
  anna = await seedUserWithResult(db, { externalId: "anna" });
});

async function payFull() {
  const purchase = await createPurchase(db, { userId: anna.userId, product: "full", target: { resultId: anna.resultId }, amountKopecks: 29900 });
  await markPurchaseSucceeded(db, purchase.id, new Date());
}

describe("runGenerate", () => {
  test("builds the full report once and announces it once", async () => {
    await runGenerate({ kind: "full", resultId: anna.resultId }, deps);
    await runGenerate({ kind: "full", resultId: anna.resultId }, deps);

    const report = await getReport(db, { resultId: anna.resultId }, "full");
    expect(report?.source).toBe("fallback");
    expect(deps.enqueueNotify).toHaveBeenCalledTimes(1);
    expect(deps.enqueueNotify).toHaveBeenCalledWith({ kind: "report_ready", reportId: report!.id });
  });

  test("uses the model when it answers well", async () => {
    const result = { scores: { openness: 60, conscientiousness: 55, extraversion: 70, agreeableness: 65, stability: 40 }, typeCode: "++++", stability: "sensitive" } as const;
    const good = JSON.stringify(fallbackSections(buildPersonalInput(getLibrary(), "chapter_money", result)));
    deps.writer = { name: "stub", complete: vi.fn().mockResolvedValue(good) };

    await runGenerate({ kind: "chapter_money", resultId: anna.resultId }, deps);

    expect((await getReport(db, { resultId: anna.resultId }, "chapter_money"))?.source).toBe("ai");
  });

  test("the friends section waits for the paid full report and three friends", async () => {
    const { id: inviteId } = await getOrCreateInvite(db, anna.resultId);
    const answers = Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, 4 as const]));
    for (const device of ["a", "b", "c"]) await addFriendResponse(db, { inviteId, answers, deviceHash: device });

    await runGenerate({ kind: "friends", resultId: anna.resultId }, deps);
    expect(await getReport(db, { resultId: anna.resultId }, "friends")).toBeNull();

    await payFull();
    await runGenerate({ kind: "friends", resultId: anna.resultId }, deps);
    expect(await getReport(db, { resultId: anna.resultId }, "friends")).not.toBeNull();
  });

  test("the pair report is built for an active pair and skipped after leaving", async () => {
    const active = await seedPair(db);
    const left = await seedPair(db);
    await leavePair(db, left.pairId, left.a.userId);

    await runGenerate({ kind: "pair", pairId: active.pairId }, deps);
    await runGenerate({ kind: "pair", pairId: left.pairId }, deps);

    expect(await getReport(db, { pairId: active.pairId }, "pair")).not.toBeNull();
    expect(await getReport(db, { pairId: left.pairId }, "pair")).toBeNull();
  });

  test("an unknown result is skipped", async () => {
    await runGenerate({ kind: "full", resultId: "00000000-0000-0000-0000-000000000000" }, deps);

    expect(deps.enqueueNotify).not.toHaveBeenCalled();
  });
});
```

В `apps/worker/src/notify.test.ts` дописать (импорт `saveReport`, `seedPair` из `@grani/db/testing`):
```ts
describe("report_ready", () => {
  test("tells the owner that the personal report is ready", async () => {
    const owner = await seedUserWithResult(db, { externalId: "300" });
    const { report } = await saveReport(db, { target: { resultId: owner.resultId }, kind: "full", sections: {}, source: "fallback" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);

    expect(telegram).toHaveBeenCalledWith("300", `Готово: полный разбор. Открыть: ${APP_URL}/report/${owner.resultId}`);
  });

  test("tells both members about the pair report, nobody after leaving", async () => {
    const pair = await seedPair(db);
    const { report } = await saveReport(db, { target: { pairId: pair.pairId }, kind: "pair", sections: {}, source: "fallback" });

    await runNotify({ kind: "report_ready", reportId: report.id }, deps);
    expect(telegram).toHaveBeenCalledTimes(2);

    telegram.mockClear();
    await leavePair(db, pair.pairId, pair.a.userId);
    await runNotify({ kind: "report_ready", reportId: report.id }, deps);
    expect(telegram).not.toHaveBeenCalled();
  });
});
```
(`leavePair` — в импорт; `seedPair` создаёт Telegram-пользователей, у них `can_notify = true`.)

```bash
pnpm vitest run apps/worker
```
Expected: FAIL — нет `./generate`, `report_ready` не обрабатывается.

- [ ] **Step 6: Генерация и уведомление**

`apps/worker/src/generate.ts`:
```ts
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
```

В `apps/worker/src/notify.ts`:
- в импорт из `@grani/db` добавить `getReportById`, `getResult`; из `./texts` — `reportReadyText`;
- добавить обработчик:
  ```ts
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
  ```
- `runNotify`:
  ```ts
  export async function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void> {
    const done =
      job.kind === "friend_answered"
        ? await notifyFriendAnswered(deps, job)
        : job.kind === "pair_created"
          ? await notifyPairCreated(deps, job)
          : await notifyReportReady(deps, job);
    if (!done) throw new Error(`Notification ${job.kind} was not delivered, retry later`);
  }
  ```

В `apps/worker/src/main.ts`:
- импорты: `GENERATE_JOB_OPTIONS`, `NOTIFY_JOB_OPTIONS`, `notifyJobKey`, `type GenerateJob` из `@grani/core`; `jobIdFor` из `@grani/db`; `getLibrary` из `@grani/content/data`; `createWriter` из `./ai`; `runGenerate` из `./generate`;
- после `await boss.createQueue(QUEUES.notify);`:
  ```ts
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
  ```
- в строку `worker started` добавить `ai: env.ai.provider`.

`GENERATE_JOB_OPTIONS` передаёт сайт при постановке задачи (`enqueueGenerate`), воркеру он не нужен — не импортировать.

- [ ] **Step 7: Проверка и коммит**

```bash
pnpm test && pnpm typecheck && pnpm --filter @grani/worker build
```
Expected: всё зелёное, `apps/worker/dist/main.mjs` собран (библиотека текстов попадает в бандл из JSON).

```bash
git add packages/db apps/worker apps/web/src/server/queue.ts pnpm-lock.yaml
git commit -m "feat(worker): generate queue with AI or library fallback, one report per target, report ready notifications"
```
