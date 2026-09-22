# Задача 2 — «Удалить мои данные»

**Files:**
- Create: `packages/db/src/delete-user.ts`, `packages/db/src/delete-user.test.ts`
- Modify: `packages/db/src/index.ts` (`export * from "./delete-user"`)
- Create: `apps/web/src/server/account-service.ts`, `apps/web/src/server/account-service.test.ts`
- Create: `apps/web/src/app/api/me/delete/route.ts`
- Create: `apps/web/src/app/me/delete/page.tsx`, `apps/web/src/app/me/delete/DeleteForm.tsx`
- Modify: `apps/web/src/app/result/[id]/page.tsx` (ссылка «Удалить мои данные» внизу страницы)

**Interfaces:**
- Consumes: `Database`, таблицы `users`, `authIdentities`, `results`, `purchases` из `@grani/db`; `SESSION_COOKIE`, `isSameOrigin`, `expiredCookieOptions`, `sessionCookieOptions` из `@/server/http`; `getCurrentUser`, `loginDeps`.
- Produces: `deleteUserData(db, userId): Promise<{ deleted: boolean }>`; `deleteAccount(deps, { sessionToken }): Promise<{ ok: true } | { ok: false; error: "unauthorized" }>`.

## Зачем

Спецификация 6: «кнопка в профиле удаляет результаты, ответы друзей, разборы и способы входа; пользователь помечается `deleted_at`. Записи об оплатах сохраняются для налогового учёта (без ответов теста)». Удаление данных одним из партнёров удаляет и пару вместе с разбором пары.

Схема уже готова к этому (план 4, задача 1; план 5, задача 2):
- от `results` каскадом удаляются `invites` → `friend_responses`, `pair_invites`, `pairs` (обе стороны ссылаются на результаты с `on delete cascade`) и `reports`;
- у `purchases` ссылки `result_id` и `pair_id` — `on delete set null`;
- `purchases.user_id` ссылается на `users` без каскада, поэтому пользователь не удаляется, а помечается `deleted_at`.

После удаления `getUser` возвращает `null` (он фильтрует по `deleted_at`), поэтому старая cookie сессии перестаёт работать. Способы входа удаляются, уникальный индекс `(provider, external_id)` освобождается. Если человек снова войдёт через тот же Telegram, это будет новый пользователь с новым согласием.

Ещё не выполненные задачи в очередях (`notify`, `generate`) после удаления находят пустоту: воркер уже обрабатывает отсутствующий результат или пару как «нечего делать» (планы 4–5). Шаг 4 это проверяет.

## Шаги

- [ ] **Шаг 1. Тест репозитория (RED).** `packages/db/src/delete-user.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authIdentities, friendResponses, invites, pairs, purchases, reports, results, users } from "./schema";
import { createTestDb, seedPair, seedUserWithResult } from "./testing";
import { deleteUserData } from "./delete-user";
import { getUser } from "./users";
import type { Database } from "./types";

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

describe("deleteUserData", () => {
  it("removes results, friend answers, reports and identities and marks the user deleted", async () => {
    const { userId, resultId } = await seedUserWithResult(db, { externalId: "tg-1" });
    const [invite] = await db.insert(invites).values({ resultId, token: "t1" }).returning();
    await db.insert(friendResponses).values({ inviteId: invite!.id, answers: { "f-01": 3 }, deviceHash: "d1" });
    await db.insert(reports).values({ resultId, kind: "full", sections: {}, source: "fallback" });

    const outcome = await deleteUserData(db, userId);

    expect(outcome).toEqual({ deleted: true });
    expect(await db.select().from(results).where(eq(results.userId, userId))).toEqual([]);
    expect(await db.select().from(friendResponses)).toEqual([]);
    expect(await db.select().from(reports)).toEqual([]);
    expect(await db.select().from(authIdentities).where(eq(authIdentities.userId, userId))).toEqual([]);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user!.deletedAt).toBeInstanceOf(Date);
    expect(await getUser(db, userId)).toBeNull();
  });

  it("keeps purchases for tax records but detaches them from the result", async () => {
    const { userId, resultId } = await seedUserWithResult(db, { externalId: "tg-2" });
    await db.insert(purchases).values({ userId, product: "full", resultId, amountKopecks: 29900, status: "succeeded" });

    await deleteUserData(db, userId);

    const [purchase] = await db.select().from(purchases);
    expect(purchase).toMatchObject({ userId, product: "full", amountKopecks: 29900, status: "succeeded", resultId: null });
  });

  it("removes the pair and the pair report for both partners", async () => {
    const { pairId, a, b } = await seedPair(db);
    await db.insert(reports).values({ pairId, kind: "pair", sections: {}, source: "fallback" });

    await deleteUserData(db, b.userId);

    expect(await db.select().from(pairs)).toEqual([]);
    expect(await db.select().from(reports)).toEqual([]);
    expect(await getUser(db, a.userId)).not.toBeNull();
    expect(await db.select().from(results).where(eq(results.userId, a.userId))).toHaveLength(1);
  });

  it("lets the same Telegram account sign up again as a new user", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-3" });
    await deleteUserData(db, userId);

    const again = await seedUserWithResult(db, { externalId: "tg-3" });

    expect(again.userId).not.toBe(userId);
  });

  it("does nothing for an unknown or already deleted user", async () => {
    const { userId } = await seedUserWithResult(db, { externalId: "tg-4" });
    await deleteUserData(db, userId);

    expect(await deleteUserData(db, userId)).toEqual({ deleted: false });
    expect(await deleteUserData(db, "not-a-uuid")).toEqual({ deleted: false });
  });
});
```

Запуск: `pnpm vitest run packages/db/src/delete-user.test.ts`. Ожидается FAIL: модуль не найден.

- [ ] **Шаг 2. Реализация.** `packages/db/src/delete-user.ts`:

```ts
import { and, eq, isNull } from "drizzle-orm";
import { authIdentities, results, users } from "./schema";
import type { Database } from "./types";
import { isUuid } from "./uuid";

// Каскады схемы уносят от результатов ссылки для друзей, ответы друзей, приглашения, пары и разборы.
// Покупки остаются для налогового учёта: их ссылки на результат и пару обнуляются (on delete set null)
export async function deleteUserData(db: Database, userId: string): Promise<{ deleted: boolean }> {
  if (!isUuid(userId)) return { deleted: false };
  return db.transaction(async (tx) => {
    const [marked] = await tx
      .update(users)
      .set({ deletedAt: new Date(), gender: null })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!marked) return { deleted: false };
    await tx.delete(results).where(eq(results.userId, userId));
    await tx.delete(authIdentities).where(eq(authIdentities.userId, userId));
    return { deleted: true };
  });
}
```

Пол тоже обнуляется: это персональные данные, а для учёта оплат он не нужен. Экспорт — в `index.ts`. Прогнать тест: PASS.

- [ ] **Шаг 3. Сервис (RED → GREEN).** `apps/web/src/server/account-service.ts`:

```ts
import { deleteUserData, type Database } from "@grani/db";
import type { AppEnv } from "./env";
import { getCurrentUser } from "./login-service";

export type AccountDeps = { db: Database; env: AppEnv };
export type DeleteAccountOutcome = { ok: true } | { ok: false; error: "unauthorized" };

export async function deleteAccount(deps: AccountDeps, p: { sessionToken: string | null }): Promise<DeleteAccountOutcome> {
  const user = await getCurrentUser(deps, p.sessionToken);
  if (!user) return { ok: false, error: "unauthorized" };
  await deleteUserData(deps.db, user.id);
  return { ok: true };
}
```

Тест `account-service.test.ts` по образцу `results-service.test.ts` (там же взять построение `env` и подписанного токена сессии):
  1. с действующей сессией — `{ ok: true }`, `getUser` → `null`, а повторный вызов с тем же токеном — `unauthorized`;
  2. без токена — `unauthorized`, и ничего не удалено.

- [ ] **Шаг 4. Воркер после удаления.** Проверить, что в `apps/worker/src/generate.test.ts` и `notify.test.ts` есть сценарии «результат/пара не найдены → задача завершается без ошибки». Если сценария для `generate` с удалённым результатом нет, добавить его: `runGenerate({ kind: "full", resultId: <удалённый> })` не бросает ошибку, не сохраняет разбор и не ставит уведомление. Если не проходит — исправить `runGenerate`, чтобы на отсутствующую цель он писал `log("info", "generate target gone", ...)` и возвращался.

- [ ] **Шаг 5. Маршрут `POST /api/me/delete`.**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { deleteAccount } from "@/server/account-service";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const outcome = await deleteAccount(deps, { sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null });
  if (!outcome.ok) return NextResponse.json(outcome, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions(sessionCookieOptions(deps.env.APP_URL)));
  return response;
}
```

Если `loginDeps()` возвращает объект с другими полями, передать `{ db: deps.db, env: deps.env }`.

- [ ] **Шаг 6. Страница `/me/delete`.** Серверная `page.tsx`: `requireUser()`, заголовок «Удалить мои данные», `metadata.robots = { index: false }`. Список того, что удалится:
  - результаты теста и ответы друзей;
  - разборы, включая купленные;
  - пара и разбор пары у обоих партнёров;
  - способы входа.

  Что останется: запись об оплате (продукт, сумма, дата) — для налогового учёта, без ответов теста. Отменить удаление нельзя.

  Клиентская `DeleteForm.tsx`:
  - галочка «Понимаю, что данные удалятся без возможности восстановления»;
  - кнопка «Удалить навсегда» (класс `button`, цвет `--danger` не нужен — достаточно подтверждения), без галочки кнопка `disabled`;
  - `fetch("/api/me/delete", { method: "POST" })`; при `ok` — `window.location.assign("/?deleted=1")`; при ошибке — сообщение в `role="alert"`.

  На главной при `?deleted=1` показать строку «Данные удалены». `page.tsx` главной получает `searchParams`.

- [ ] **Шаг 7. Ссылка.** Внизу `result/[id]/page.tsx` (только владельцу) — ссылка «Удалить мои данные» → `/me/delete`, класс `muted`.

- [ ] **Шаг 8. Проверка.** `pnpm typecheck`; `pnpm vitest run packages/db apps/web apps/worker`. Вживую в превью:
  1. dev-вход «Аня» → тест → результат → «Удалить мои данные» → подтвердить;
  2. главная с «Данные удалены»;
  3. `/me` → `/login`;
  4. старая ссылка `/result/<id>` → 404.

- [ ] **Шаг 9. Коммит.**

```bash
git add packages/db/src/delete-user.ts packages/db/src/delete-user.test.ts packages/db/src/index.ts apps/web/src/server/account-service.ts apps/web/src/server/account-service.test.ts apps/web/src/app/api/me apps/web/src/app/me/delete apps/web/src/app/result apps/web/src/app/page.tsx apps/worker/src
git commit -m "feat(account): delete my data — results, pairs, reports and identities, purchases kept for tax records"
```
