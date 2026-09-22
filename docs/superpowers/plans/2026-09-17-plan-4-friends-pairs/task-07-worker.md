# Task 7: `apps/worker` — уведомления в Telegram и ВКонтакте

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/vitest.config.ts`, `apps/worker/scripts/build.mjs`
- Create: `apps/worker/src/main.ts`, `env.ts`, `log.ts`, `senders.ts`, `telegram.ts`, `vk.ts`, `texts.ts`, `notify.ts`
- Modify: `packages/db/src/pairs.ts`, `package.json` (`dev:worker`), `vitest.config.ts` (покрытие), `apps/web/.env.development.example`, `.gitignore`
- Test: `apps/worker/src/env.test.ts`, `telegram.test.ts`, `vk.test.ts`, `texts.test.ts`, `notify.test.ts`, `packages/db/src/pairs.test.ts` (дополнение)

**Interfaces:**
- Consumes: `QUEUES`, `NotifyJob`, `NOTIFY_JOB_OPTIONS`, `compatibilityScore` (`@grani/core`); `getFriendAnsweredNotice`, `getNotifyTargets`, `setCanNotify`, `PairRecord`, `createDb`, `seedUserWithResult` (Task 1, план 3).
- Produces:
  ```ts
  // packages/db/src/pairs.ts
  function getActivePair(db: Database, pairId: string): Promise<PairRecord | null>; // без проверки участника, только для воркера

  // apps/worker/src/senders.ts
  type SendOutcome = "sent" | "rejected" | "failed";
  type Sender = (externalId: string, text: string) => Promise<SendOutcome>;
  type Senders = Partial<Record<AuthProvider, Sender>>;
  function dryRunSender(provider: AuthProvider, log: Logger): Sender;

  // telegram.ts
  function telegramOutcome(error: unknown): SendOutcome;
  function createTelegramSender(api: { sendMessage(chatId: string, text: string, other?: object): Promise<unknown> }): Sender;

  // vk.ts
  const VK_API_VERSION = "5.199";
  function createVkSender(p: { token: string; fetchFn: typeof fetch; randomId?: () => number }): Sender;

  // texts.ts
  function friendAnsweredText(friendsCount: number, url: string): string;
  function pairCreatedText(partnerFirstName: string, score: number, url: string): string;

  // notify.ts
  type NotifyDeps = { db: Database; senders: Senders; appUrl: string; log: Logger };
  function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void>; // бросает, только если ничего не отправлено и была временная ошибка

  // env.ts
  type WorkerEnv = { DATABASE_URL: string; APP_URL: string; telegramToken: string | null; vkGroupToken: string | null; dryRun: boolean; poolMax: number };
  function readWorkerEnv(source?: Record<string, string | undefined>): WorkerEnv;
  ```

Воркер — отдельный процесс на pg-boss, как в wishlist, но без бота с командами: он только разбирает очередь `notify`. На каждую задачу он сам читает базу (число ответов, участников пары, адреса с `can_notify`), собирает текст и отправляет каждому адресу пользователя.

**Исходы отправки.** `sent` — готово. `rejected` — платформа отказала навсегда (Telegram 400/403, ВКонтакте 901/902/7) → `can_notify = false`, повтор не нужен. `failed` — временная ошибка (сеть, 429, 5xx) → если ни одному адресу этого пользователя сообщение не ушло, задача бросает ошибку, и pg-boss повторит её (до 3 раз). Если хотя бы один адрес получил сообщение, задача завершается: повтор отправил бы его второй раз.

**Локально** (`NOTIFICATIONS_DRY_RUN=1` в `.env.development.local`) отправители только пишут в лог «dry run notification» с провайдером и текстом — без запросов к Telegram и ВКонтакте. Так тестовый вход и сквозные сценарии не упираются в ненастоящий токен бота.

Тексты — простой текст без разметки и без родовых окончаний; имя партнёра — первое слово имени.

- [ ] **Step 1: Пакет**

`apps/worker/package.json`:
```json
{
  "name": "@grani/worker",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "build": "node scripts/build.mjs",
    "dev": "node scripts/build.mjs && node --env-file-if-exists=../web/.env.development.local dist/main.mjs"
  },
  "dependencies": {
    "@grani/core": "workspace:*",
    "@grani/db": "workspace:*",
    "grammy": "1.46.0",
    "pg-boss": "12.31.1",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "esbuild": "0.28.2"
  }
}
```

`apps/worker/tsconfig.json`, `apps/worker/vitest.config.ts`, `apps/worker/src/log.ts` — перенести из `C:\dev\wishlist\apps\worker\` без изменений (в `vitest.config.ts` имя проекта `worker`).

`apps/worker/scripts/build.mjs` — из wishlist, но `external: ["pg-native", "grammy"]` (sharp в воркере «Граней» нет).

В корневой `package.json` в `scripts`: `"dev:worker": "pnpm --filter @grani/worker dev"`. В корневом `vitest.config.ts` в `coverage.include` добавить `"apps/worker/src/**/*.ts"`, в `coverage.exclude` — `"**/main.ts"`. В `.gitignore` добавить `apps/worker/dist/`. В `apps/web/.env.development.example` добавить строку `NOTIFICATIONS_DRY_RUN=1`.

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install
```

- [ ] **Step 2: Тесты (падают)**

В `packages/db/src/pairs.test.ts` в `describe("membership and leaving")`:
```ts
  test("the worker reads an active pair without being a member, but not a left one", async () => {
    const outcome = await accept((await invite()).token);
    const pairId = outcome.ok ? outcome.pairId : "";

    expect((await getActivePair(db, pairId))?.members.map((member) => member.user.id)).toEqual([anna.userId, boris.userId]);
    await leavePair(db, pairId, anna.userId);
    expect(await getActivePair(db, pairId)).toBeNull();
  });
```
и `getActivePair` в импорт.

`apps/worker/src/env.test.ts`:
```ts
import { expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const BASE = { DATABASE_URL: "postgres://u:p@db/grani", APP_URL: "https://grani-test.ru" };

test("works without any messenger configured", () => {
  expect(readWorkerEnv(BASE)).toEqual({ ...BASE, telegramToken: null, vkGroupToken: null, dryRun: false, poolMax: 3 });
});

test("reads tokens and the dry run switch", () => {
  expect(readWorkerEnv({ ...BASE, TELEGRAM_BOT_TOKEN: "123:abc", VK_GROUP_TOKEN: "vk1.a.token", NOTIFICATIONS_DRY_RUN: "1" })).toEqual({
    ...BASE,
    telegramToken: "123:abc",
    vkGroupToken: "vk1.a.token",
    dryRun: true,
    poolMax: 3,
  });
});

test("takes the pool size from DATABASE_POOL_MAX, like the site", () => {
  expect(readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "1" }).poolMax).toBe(1);
  expect(() => readWorkerEnv({ ...BASE, DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
});

test("names invalid variables without printing values", () => {
  const run = () => readWorkerEnv({ DATABASE_URL: "", APP_URL: "not a url", TELEGRAM_BOT_TOKEN: "secret-bad" });

  expect(run).toThrow(/DATABASE_URL/);
  expect(run).toThrow(/APP_URL/);
  expect(run).not.toThrow(/secret-bad/);
});
```

`apps/worker/src/telegram.test.ts`:
```ts
import { GrammyError, HttpError } from "grammy";
import { expect, test, vi } from "vitest";
import { createTelegramSender, telegramOutcome } from "./telegram";

const apiError = (code: number, description: string) =>
  new GrammyError(`Call failed (${code}: ${description})`, { ok: false, error_code: code, description }, "sendMessage", {});

test("permanent refusals are not retried, temporary errors are", () => {
  expect(telegramOutcome(apiError(403, "Forbidden: bot was blocked by the user"))).toBe("rejected");
  expect(telegramOutcome(apiError(400, "Bad Request: chat not found"))).toBe("rejected");
  expect(telegramOutcome(apiError(429, "Too Many Requests"))).toBe("failed");
  expect(telegramOutcome(new HttpError("Network request failed", new Error("ECONNRESET")))).toBe("failed");
});

test("sends plain text without link previews", async () => {
  const api = { sendMessage: vi.fn().mockResolvedValue({}) };

  expect(await createTelegramSender(api)("42", "Привет")).toBe("sent");
  expect(api.sendMessage).toHaveBeenCalledWith("42", "Привет", { link_preview_options: { is_disabled: true } });
});
```

`apps/worker/src/vk.test.ts`:
```ts
import { describe, expect, test, vi } from "vitest";
import { createVkSender, VK_API_VERSION } from "./vk";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("createVkSender", () => {
  test("posts messages.send with the community token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ response: 123 }));
    const send = createVkSender({ token: "vk-token", fetchFn, randomId: () => 777 });

    expect(await send("555", "Привет")).toBe("sent");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.vk.ru/method/messages.send");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      user_id: "555",
      random_id: "777",
      message: "Привет",
      access_token: "vk-token",
      v: VK_API_VERSION,
    });
  });

  test.each([
    [901, "rejected"],
    [902, "rejected"],
    [7, "rejected"],
    [6, "failed"],
    [10, "failed"],
  ] as const)("maps VK error %s to %s", async (code, outcome) => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { error_code: code, error_msg: "x" } }));

    expect(await createVkSender({ token: "t", fetchFn })("1", "x")).toBe(outcome);
  });

  test("treats a network failure as temporary", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    expect(await createVkSender({ token: "t", fetchFn })("1", "x")).toBe("failed");
  });
});
```

`apps/worker/src/texts.test.ts`:
```ts
import { expect, test } from "vitest";
import { friendAnsweredText, pairCreatedText } from "./texts";

const URL = "https://grani-test.ru/result/1";

test("friend answers count up to three, then announce the comparison", () => {
  expect(friendAnsweredText(1, URL)).toBe(`Ещё один друг ответил на вопросы о тебе — 1 из 3. Когда ответят трое, откроется сравнение «Как тебя видят другие»: ${URL}`);
  expect(friendAnsweredText(2, URL)).toContain("2 из 3");
  expect(friendAnsweredText(3, URL)).toBe(`Ответили трое друзей — сравнение «Как тебя видят другие» готово: ${URL}`);
  expect(friendAnsweredText(4, URL)).toBe(`Ответил ещё один друг, сравнение обновилось. Всего ответов: 4. ${URL}`);
});

test("a created pair names the partner and the score", () => {
  expect(pairCreatedText("Борис", 78, "https://grani-test.ru/pair/9")).toBe(
    "Пара готова: вы и Борис, совместимость 78%. Посмотреть типы и шкалы рядом: https://grani-test.ru/pair/9",
  );
});
```

`apps/worker/src/notify.test.ts`:
```ts
import { compatibilityScore, type TraitScores } from "@grani/core";
import {
  acceptPairInvite,
  addFriendResponse,
  createTestDb,
  getNotifyTargets,
  getOrCreateInvite,
  getOrCreatePairInvite,
  seedUserWithResult,
  setCanNotify,
  type Database,
} from "@grani/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { runNotify, type NotifyDeps } from "./notify";
import type { Sender } from "./senders";

const APP_URL = "https://grani-test.ru";
const A: TraitScores = { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 55 };
const B: TraitScores = { openness: 45, conscientiousness: 70, extraversion: 30, agreeableness: 60, stability: 40 };

let db: Database;
let telegram: ReturnType<typeof vi.fn<Sender>>;
let vk: ReturnType<typeof vi.fn<Sender>>;
let deps: NotifyDeps;

beforeEach(async () => {
  db = await createTestDb();
  telegram = vi.fn<Sender>().mockResolvedValue("sent");
  vk = vi.fn<Sender>().mockResolvedValue("sent");
  deps = { db, senders: { telegram, vk }, appUrl: APP_URL, log: vi.fn() };
});

describe("friend_answered", () => {
  test("tells the owner the current count with a link to the result", async () => {
    const owner = await seedUserWithResult(db, { externalId: "100" });
    const { id: inviteId } = await getOrCreateInvite(db, owner.resultId);
    await addFriendResponse(db, { inviteId, answers: {}, deviceHash: "a" });

    await runNotify({ kind: "friend_answered", inviteId, friendsCount: 1 }, deps);

    expect(telegram).toHaveBeenCalledWith("100", expect.stringContaining(`1 из 3`));
    expect(telegram.mock.calls[0]?.[1]).toContain(`${APP_URL}/result/${owner.resultId}`);
  });

  test("does nothing for a deleted invite", async () => {
    await runNotify({ kind: "friend_answered", inviteId: "00000000-0000-0000-0000-000000000000", friendsCount: 1 }, deps);

    expect(telegram).not.toHaveBeenCalled();
  });
});

describe("pair_created", () => {
  async function createPair() {
    const anna = await seedUserWithResult(db, { externalId: "201", displayName: "Аня Петрова", scores: A });
    const boris = await seedUserWithResult(db, { externalId: "202", provider: "vk", displayName: "Борис", scores: B });
    await setCanNotify(db, { provider: "vk", externalId: "202", canNotify: true });
    const { token } = await getOrCreatePairInvite(db, anna);
    const outcome = await acceptPairInvite(db, { token, partnerUserId: boris.userId, partnerResultId: boris.resultId, consentAt: new Date() });
    if (!outcome.ok) throw new Error("pair was not created");
    return { anna, boris, pairId: outcome.pairId };
  }

  test("tells both members with the partner's name and the score", async () => {
    const { pairId } = await createPair();
    const score = compatibilityScore(A, B);

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(telegram).toHaveBeenCalledWith("201", `Пара готова: вы и Борис, совместимость ${score}%. Посмотреть типы и шкалы рядом: ${APP_URL}/pair/${pairId}`);
    expect(vk).toHaveBeenCalledWith("202", expect.stringContaining("вы и Аня,"));
  });

  test("stops notifying an address the platform refused", async () => {
    const { anna, pairId } = await createPair();
    telegram.mockResolvedValue("rejected");

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(await getNotifyTargets(db, anna.userId)).toEqual([]);
  });

  test("asks for a retry only when nothing was delivered because of a temporary error", async () => {
    const { pairId } = await createPair();
    telegram.mockResolvedValue("failed");
    vk.mockResolvedValue("failed");

    await expect(runNotify({ kind: "pair_created", pairId }, deps)).rejects.toThrow(/retry/);
  });

  test("does not retry when one member already got the message", async () => {
    const { pairId } = await createPair();
    telegram.mockResolvedValue("failed");

    await expect(runNotify({ kind: "pair_created", pairId }, deps)).resolves.toBeUndefined();
  });

  test("skips providers without a configured sender", async () => {
    const { pairId } = await createPair();
    deps.senders = { vk };

    await runNotify({ kind: "pair_created", pairId }, deps);

    expect(vk).toHaveBeenCalledTimes(1);
  });
});
```

```bash
pnpm vitest run packages/db/src/pairs.test.ts apps/worker
```
Expected: FAIL — нет `getActivePair` и модулей воркера.

- [ ] **Step 3: Реализация**

В `packages/db/src/pairs.ts` выделить загрузку пары и переиспользовать её в `getPairForMember`:
```ts
async function loadPair(db: Database, where: SQL | undefined): Promise<PairRecord | null> {
  const [row] = await db.select().from(pairs).where(where).limit(1);
  if (!row) return null;
  const [a, b] = await Promise.all([loadMember(db, row.userAId, row.resultAId), loadMember(db, row.userBId, row.resultBId)]);
  return a && b ? { id: row.id, createdAt: row.createdAt, members: [a, b] } : null;
}

export async function getActivePair(db: Database, pairId: string): Promise<PairRecord | null> {
  if (!isUuid(pairId)) return null;
  return loadPair(db, and(eq(pairs.id, pairId), isNull(pairs.leftAt)));
}

export async function getPairForMember(db: Database, pairId: string, userId: string): Promise<PairRecord | null> {
  if (!isUuid(pairId) || !isUuid(userId)) return null;
  return loadPair(db, and(eq(pairs.id, pairId), isNull(pairs.leftAt), or(eq(pairs.userAId, userId), eq(pairs.userBId, userId))));
}
```
с `type SQL` в импорте из `drizzle-orm`.

`apps/worker/src/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url(),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/).optional(),
  VK_GROUP_TOKEN: z.string().min(1).optional(),
  NOTIFICATIONS_DRY_RUN: z.enum(["0", "1"]).optional(),
  // Локальная PGlite-БД путает одновременные запросы с разных соединений: там DATABASE_POOL_MAX=1, как у сайта
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(3),
});

export type WorkerEnv = { DATABASE_URL: string; APP_URL: string; telegramToken: string | null; vkGroupToken: string | null; dryRun: boolean; poolMax: number };

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid worker environment variables: ${fields}`);
  }
  const env = parsed.data;
  return {
    DATABASE_URL: env.DATABASE_URL,
    APP_URL: env.APP_URL,
    telegramToken: env.TELEGRAM_BOT_TOKEN ?? null,
    vkGroupToken: env.VK_GROUP_TOKEN ?? null,
    dryRun: env.NOTIFICATIONS_DRY_RUN === "1",
    poolMax: env.DATABASE_POOL_MAX,
  };
}
```

`apps/worker/src/senders.ts`:
```ts
import type { AuthProvider } from "@grani/db";
import type { Logger } from "./log";

export type SendOutcome = "sent" | "rejected" | "failed";
export type Sender = (externalId: string, text: string) => Promise<SendOutcome>;
export type Senders = Partial<Record<AuthProvider, Sender>>;

// Локально сообщения не уходят наружу: токен бота в .env.development.local ненастоящий
export function dryRunSender(provider: AuthProvider, log: Logger): Sender {
  return async (externalId, text) => {
    log("info", "dry run notification", { provider, externalIdLength: externalId.length, text });
    return "sent";
  };
}
```

`apps/worker/src/telegram.ts`:
```ts
import { GrammyError } from "grammy";
import type { Sender, SendOutcome } from "./senders";

type TelegramApi = { sendMessage(chatId: string, text: string, other?: object): Promise<unknown> };

// 403 — пользователь заблокировал бота или не разрешил ему писать; 400 — чат не найден. Повтор не поможет
export function telegramOutcome(error: unknown): SendOutcome {
  if (error instanceof GrammyError && (error.error_code === 400 || error.error_code === 403)) return "rejected";
  return "failed";
}

export function createTelegramSender(api: TelegramApi): Sender {
  return async (externalId, text) => {
    try {
      await api.sendMessage(externalId, text, { link_preview_options: { is_disabled: true } });
      return "sent";
    } catch (error) {
      return telegramOutcome(error);
    }
  };
}
```

`apps/worker/src/vk.ts`:
```ts
import { randomInt } from "node:crypto";
import type { Sender, SendOutcome } from "./senders";

export const VK_API_VERSION = "5.199";
const VK_API_URL = "https://api.vk.ru/method/messages.send";
// 901 — пользователь запретил сообщения сообщества, 902 — настройки приватности, 7 — у ключа нет прав
const PERMANENT_ERRORS = new Set([7, 901, 902]);
const MAX_RANDOM_ID = 2 ** 31 - 1;

export function createVkSender(p: { token: string; fetchFn: typeof fetch; randomId?: () => number }): Sender {
  const randomId = p.randomId ?? (() => randomInt(MAX_RANDOM_ID));
  return async (externalId, text): Promise<SendOutcome> => {
    try {
      const response = await p.fetchFn(VK_API_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ user_id: externalId, random_id: String(randomId()), message: text, access_token: p.token, v: VK_API_VERSION }).toString(),
      });
      const body = (await response.json()) as { response?: unknown; error?: { error_code?: number } };
      if (body.response !== undefined) return "sent";
      return PERMANENT_ERRORS.has(body.error?.error_code ?? -1) ? "rejected" : "failed";
    } catch {
      return "failed";
    }
  };
}
```

`random_id` в ВКонтакте защищает от дублей при повторе одного и того же запроса, но между разными попытками pg-boss он новый — дубли между попытками исключает правило «не повторять, если хоть что-то ушло».

`apps/worker/src/texts.ts`:
```ts
import { MIN_FRIENDS } from "@grani/core";

export function friendAnsweredText(friendsCount: number, url: string): string {
  if (friendsCount < MIN_FRIENDS) {
    return `Ещё один друг ответил на вопросы о тебе — ${friendsCount} из ${MIN_FRIENDS}. Когда ответят трое, откроется сравнение «Как тебя видят другие»: ${url}`;
  }
  if (friendsCount === MIN_FRIENDS) return `Ответили трое друзей — сравнение «Как тебя видят другие» готово: ${url}`;
  return `Ответил ещё один друг, сравнение обновилось. Всего ответов: ${friendsCount}. ${url}`;
}

export function pairCreatedText(partnerFirstName: string, score: number, url: string): string {
  return `Пара готова: вы и ${partnerFirstName}, совместимость ${score}%. Посмотреть типы и шкалы рядом: ${url}`;
}
```

`apps/worker/src/notify.ts`:
```ts
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
  const done = job.kind === "friend_answered" ? await notifyFriendAnswered(deps, job) : await notifyPairCreated(deps, job);
  if (!done) throw new Error(`Notification ${job.kind} was not delivered, retry later`);
}
```

`apps/worker/src/main.ts`:
```ts
import { QUEUES, type NotifyJob } from "@grani/core";
import { createDb } from "@grani/db";
import { Api } from "grammy";
import { PgBoss } from "pg-boss";
import { readWorkerEnv } from "./env";
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

log("info", "worker started", { telegram: senders.telegram !== undefined, vk: senders.vk !== undefined, dryRun: env.dryRun });

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
```

- [ ] **Step 4: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck && pnpm --filter @grani/worker build
```
Expected: всё зелёное, `apps/worker/dist/main.mjs` собран.

- [ ] **Step 5: Проверка вживую**

В `apps/web/.env.development.local` добавить `NOTIFICATIONS_DRY_RUN=1`. В трёх терминалах: `pnpm dev:db`, `pnpm dev:web`, `pnpm dev:worker` (Expected: `worker started` с `"dryRun":true`). Войти (`/api/dev/login?name=Аня`), получить ссылку для друзей, ответить из инкогнито. Expected в логе воркера: `dry run notification` с текстом «Ещё один друг ответил на вопросы о тебе — 1 из 3…». Создать пару по сценарию Task 6 → две строки `dry run notification` с «Пара готова: вы и …».

- [ ] **Step 6: Коммит**

```bash
git add apps/worker package.json pnpm-lock.yaml vitest.config.ts .gitignore apps/web/.env.development.example packages/db/src/pairs.ts packages/db/src/pairs.test.ts
git commit -m "feat(worker): notification queue with Telegram and VK senders, friend and pair messages"
```
