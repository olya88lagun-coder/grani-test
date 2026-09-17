# Task 8: Разрешение на сообщения ВКонтакте — Callback API и кнопка

**Files:**
- Create: `apps/web/src/server/vk-callback.ts`, `apps/web/src/app/api/vk/callback/route.ts`, `apps/web/src/components/VkAllowMessages.tsx`, `apps/web/src/app/result/[id]/NotificationsBlock.tsx`
- Modify: `packages/db/src/notify-targets.ts`, `apps/web/src/server/env.ts`, `apps/web/src/app/result/[id]/page.tsx`
- Test: `apps/web/src/server/vk-callback.test.ts`, `apps/web/src/server/env.test.ts` (дополнение), `packages/db/src/notify-targets.test.ts` (дополнение)

**Interfaces:**
- Consumes: `setCanNotify` (Task 1); `AppEnv`, `readEnv` (план 3).
- Produces:
  ```ts
  // packages/db/src/notify-targets.ts
  type IdentityNotice = { provider: AuthProvider; canNotify: boolean };
  function listIdentityNotices(db: Database, userId: string): Promise<IdentityNotice[]>;

  // env.ts — необязательные, все четыре вместе
  type VkCommunityConfig = { groupId: string; callbackSecret: string; confirmationCode: string };
  type AppEnv = … & { vkCommunity: VkCommunityConfig | null };

  // vk-callback.ts
  type CallbackReply = { status: number; body: string };
  function handleVkCallback(db: Database, config: VkCommunityConfig, payload: unknown): Promise<CallbackReply>;

  // components/VkAllowMessages.tsx (client)
  function VkAllowMessages(props: { groupId: string }): ReactElement;
  ```

ВКонтакте разрешает сообществу писать человеку, только если он сам нажал «Разрешить сообщения» или написал сообществу. Об этом сервер узнаёт из Callback API:
- `confirmation` — ВКонтакте проверяет адрес при настройке; ответ — строка подтверждения из настроек сообщества.
- `message_allow` (`object.user_id`) → `can_notify = true` у ВК-идентичности с этим `external_id`.
- `message_deny` (`object.user_id`) → `can_notify = false`.
- `message_new` (`object.message.from_id`) → `can_notify = true`: человек сам написал сообществу.
- Любое другое событие — просто `ok`.

Каждый запрос проверяется: `group_id` совпадает с `VK_GROUP_ID`, `secret` совпадает с `VK_CALLBACK_SECRET` (сравнение за постоянное время). Иначе — `403 forbidden`. На принятое событие ответ — ровно `ok` со статусом 200, иначе ВКонтакте будет повторять. Если ВК-переменные не заданы, маршрут отвечает 404.

Кнопка «Разрешить сообщения» — официальный виджет ВКонтакте `VK.Widgets.AllowMessagesFromCommunity` из `https://vk.com/js/api/openapi.js`. Показывается на странице результата только пользователю, у которого есть ВК-идентичность без разрешения, и только когда ВК-переменные заданы.

- [ ] **Step 1: Тесты (падают)**

В `packages/db/src/notify-targets.test.ts`:
```ts
describe("listIdentityNotices", () => {
  test("lists every login of the user with its permission", async () => {
    const vk = await seedUserWithResult(db, { externalId: "333", provider: "vk" });

    expect(await listIdentityNotices(db, vk.userId)).toEqual([{ provider: "vk", canNotify: false }]);
    expect(await listIdentityNotices(db, "bad")).toEqual([]);
  });
});
```
и `listIdentityNotices` в импорт.

В `apps/web/src/server/env.test.ts`:
```ts
describe("VK community settings", () => {
  const VK = { VK_GROUP_ID: "230000000", VK_CALLBACK_SECRET: "cb-secret", VK_CONFIRMATION_CODE: "a1b2c3" };

  test("are off when not configured", () => {
    expect(readEnv(VALID).vkCommunity).toBeNull();
  });

  test("are read together", () => {
    expect(readEnv({ ...VALID, ...VK }).vkCommunity).toEqual({ groupId: "230000000", callbackSecret: "cb-secret", confirmationCode: "a1b2c3" });
  });

  test("fail when only some are set", () => {
    expect(() => readEnv({ ...VALID, VK_GROUP_ID: "230000000" })).toThrow(/VK_CALLBACK_SECRET/);
  });
});
```
В этом файле тест `"accepts a complete environment"` теперь ожидает `{ ...VALID, vkCommunity: null }`.

`apps/web/src/server/vk-callback.test.ts`:
```ts
import { createTestDb, getNotifyTargets, seedUserWithResult, type Database } from "@grani/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { handleVkCallback } from "./vk-callback";

const CONFIG = { groupId: "230000000", callbackSecret: "cb-secret", confirmationCode: "a1b2c3" };
const event = (type: string, object: unknown = {}, overrides: Record<string, unknown> = {}) => ({
  type,
  group_id: 230000000,
  secret: "cb-secret",
  object,
  ...overrides,
});

let db: Database;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ userId } = await seedUserWithResult(db, { externalId: "555", provider: "vk" }));
});

describe("handleVkCallback", () => {
  test("answers the confirmation request with the code", async () => {
    expect(await handleVkCallback(db, CONFIG, event("confirmation"))).toEqual({ status: 200, body: "a1b2c3" });
  });

  test("turns notifications on when the user allows messages or writes to the community", async () => {
    expect(await handleVkCallback(db, CONFIG, event("message_allow", { user_id: 555 }))).toEqual({ status: 200, body: "ok" });
    expect(await getNotifyTargets(db, userId)).toEqual([{ provider: "vk", externalId: "555" }]);

    await handleVkCallback(db, CONFIG, event("message_deny", { user_id: 555 }));
    expect(await getNotifyTargets(db, userId)).toEqual([]);

    await handleVkCallback(db, CONFIG, event("message_new", { message: { from_id: 555, text: "привет" } }));
    expect(await getNotifyTargets(db, userId)).toHaveLength(1);
  });

  test("ignores other events", async () => {
    expect(await handleVkCallback(db, CONFIG, event("wall_post_new", { id: 1 }))).toEqual({ status: 200, body: "ok" });
  });

  test.each([
    ["a wrong secret", event("message_allow", { user_id: 555 }, { secret: "nope" })],
    ["another community", event("message_allow", { user_id: 555 }, { group_id: 1 })],
    ["garbage", "not json"],
  ])("refuses %s without changing anything", async (_, payload) => {
    expect(await handleVkCallback(db, CONFIG, payload)).toEqual({ status: 403, body: "forbidden" });
    expect(await getNotifyTargets(db, userId)).toEqual([]);
  });
});
```

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/db/src/notify-targets.test.ts apps/web/src/server/env.test.ts apps/web/src/server/vk-callback.test.ts
```
Expected: FAIL.

- [ ] **Step 2: Реализация**

В `packages/db/src/notify-targets.ts`:
```ts
export type IdentityNotice = { provider: AuthProvider; canNotify: boolean };

export async function listIdentityNotices(db: Database, userId: string): Promise<IdentityNotice[]> {
  if (!isUuid(userId)) return [];
  return db
    .select({ provider: authIdentities.provider, canNotify: authIdentities.canNotify })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId));
}
```

`apps/web/src/server/env.ts` — схема получает три необязательные переменные, `readEnv` собирает их в `vkCommunity`:
```ts
import { z } from "zod";

const VK_COMMUNITY_KEYS = ["VK_GROUP_ID", "VK_CALLBACK_SECRET", "VK_CONFIRMATION_CODE"] as const;

const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  VK_CLIENT_ID: z.string().regex(/^\d+$/),
  VK_GROUP_ID: z.string().regex(/^\d+$/).optional(),
  VK_CALLBACK_SECRET: z.string().min(1).optional(),
  VK_CONFIRMATION_CODE: z.string().min(1).optional(),
});

export type VkCommunityConfig = { groupId: string; callbackSecret: string; confirmationCode: string };
type ParsedEnv = z.infer<typeof envSchema>;
export type AppEnv = Omit<ParsedEnv, (typeof VK_COMMUNITY_KEYS)[number]> & { vkCommunity: VkCommunityConfig | null };

function fail(fields: readonly string[]): never {
  throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
}

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) fail(parsed.error.issues.map((issue) => issue.path.join(".")));
  const { VK_GROUP_ID, VK_CALLBACK_SECRET, VK_CONFIRMATION_CODE, ...rest } = parsed.data;
  const missing = VK_COMMUNITY_KEYS.filter((key) => !parsed.data[key]);
  // Сообщество либо настроено целиком, либо выключено: частичная настройка — ошибка выкладки
  if (missing.length > 0 && missing.length < VK_COMMUNITY_KEYS.length) fail(missing);
  const vkCommunity =
    VK_GROUP_ID && VK_CALLBACK_SECRET && VK_CONFIRMATION_CODE
      ? { groupId: VK_GROUP_ID, callbackSecret: VK_CALLBACK_SECRET, confirmationCode: VK_CONFIRMATION_CODE }
      : null;
  return { ...rest, vkCommunity };
}
```
`getEnv` не меняется. Тест входа (`login-service.test.ts`) и другие места, где собирается `AppEnv` вручную, дополнить полем `vkCommunity: null`.

`apps/web/src/server/vk-callback.ts`:
```ts
import { timingSafeEqual } from "node:crypto";
import { setCanNotify, type Database } from "@grani/db";
import type { VkCommunityConfig } from "./env";

export type CallbackReply = { status: number; body: string };

const OK: CallbackReply = { status: 200, body: "ok" };
const FORBIDDEN: CallbackReply = { status: 403, body: "forbidden" };

type Payload = { type?: unknown; group_id?: unknown; secret?: unknown; object?: Record<string, unknown> };

function sameSecret(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function vkUserId(value: unknown): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

async function allow(db: Database, userId: string | null, canNotify: boolean): Promise<void> {
  if (userId) await setCanNotify(db, { provider: "vk", externalId: userId, canNotify });
}

export async function handleVkCallback(db: Database, config: VkCommunityConfig, payload: unknown): Promise<CallbackReply> {
  if (typeof payload !== "object" || payload === null) return FORBIDDEN;
  const event = payload as Payload;
  if (String(event.group_id) !== config.groupId) return FORBIDDEN;
  if (event.type === "confirmation") return { status: 200, body: config.confirmationCode };
  if (!sameSecret(event.secret, config.callbackSecret)) return FORBIDDEN;

  const object = event.object ?? {};
  if (event.type === "message_allow") await allow(db, vkUserId(object.user_id), true);
  if (event.type === "message_deny") await allow(db, vkUserId(object.user_id), false);
  if (event.type === "message_new") {
    const message = object.message as { from_id?: unknown } | undefined;
    await allow(db, vkUserId(message?.from_id), true);
  }
  return OK;
}
```

Запрос `confirmation` ВКонтакте присылает без `secret`, поэтому для него проверяется только `group_id`: ответ раскрывает лишь строку подтверждения, которая и так видна в настройках сообщества.

`apps/web/src/app/api/vk/callback/route.ts`:
```ts
import type { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { handleVkCallback } from "@/server/vk-callback";

export async function POST(request: NextRequest) {
  const config = getEnv().vkCommunity;
  if (!config) return new Response("not found", { status: 404 });
  const payload: unknown = await request.json().catch(() => null);
  const reply = await handleVkCallback(getDb(), config, payload);
  return new Response(reply.body, { status: reply.status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
```

Проверка `Origin` здесь не нужна и не сработала бы: запросы приходят с серверов ВКонтакте, подлинность подтверждает секрет.

`apps/web/src/components/VkAllowMessages.tsx`:
```tsx
"use client";

import { useEffect, useId } from "react";

type VkWidgets = { Widgets: { AllowMessagesFromCommunity(elementId: string, options: { height: number }, groupId: number): void } };

const OPENAPI_SRC = "https://vk.com/js/api/openapi.js?169";

export function VkAllowMessages({ groupId }: { groupId: string }) {
  const elementId = `vk-allow-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const render = () => (window as unknown as { VK?: VkWidgets }).VK?.Widgets.AllowMessagesFromCommunity(elementId, { height: 30 }, Number(groupId));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENAPI_SRC}"]`);
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = OPENAPI_SRC;
    script.async = true;
    script.onload = render;
    document.body.append(script);
  }, [elementId, groupId]);

  return <div id={elementId} style={{ minHeight: 30 }} />;
}
```

`apps/web/src/app/result/[id]/NotificationsBlock.tsx`:
```tsx
import { listIdentityNotices } from "@grani/db";
import { VkAllowMessages } from "@/components/VkAllowMessages";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

export async function NotificationsBlock({ userId }: { userId: string }) {
  const community = getEnv().vkCommunity;
  if (!community) return null;
  const identities = await listIdentityNotices(getDb(), userId);
  const needsVkPermission = identities.some((identity) => identity.provider === "vk" && !identity.canNotify);
  if (!needsVkPermission) return null;

  return (
    <section className="card card--paper stack" aria-labelledby="notifications">
      <p className="eyebrow">Уведомления</p>
      <h2 id="notifications">Сообщать ВКонтакте о новых ответах друзей и паре</h2>
      <p className="muted">Без разрешения всё будет видно здесь, на сайте. Отключить сообщения можно в любой момент в диалоге с сообществом.</p>
      <VkAllowMessages groupId={community.groupId} />
    </section>
  );
}
```

В `apps/web/src/app/result/[id]/page.tsx` после `<PairsBlock … />` добавить `<NotificationsBlock userId={user.id} />` и импорт.

- [ ] **Step 3: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: всё зелёное.

Проверка маршрута без ВК-переменных:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/vk/callback -d '{}'
```
Expected: `404`.

- [ ] **Step 4: Данные от пользователя**

Попросить у пользователя ID сообщества (раздел «Предварительные действия» в `00-overview.md`) и записать его в `docs/superpowers/plans/2026-09-17-plan-4-friends-pairs/00-overview.md` в Global Constraints: `VK_GROUP_ID` = `<число>`. Ключ сообщества, секрет Callback API и строка подтверждения задаются на сервере в плане 6 — в репозиторий не попадают. Если пользователь ещё не создал сообщество, продолжить без этого шага: код от него не зависит.

- [ ] **Step 5: Коммит**

```bash
git add packages/db/src/notify-targets.ts packages/db/src/notify-targets.test.ts apps/web/src docs/superpowers/plans/2026-09-17-plan-4-friends-pairs/00-overview.md
git commit -m "feat(web): VK Callback API for message permission and allow-messages button"
```
