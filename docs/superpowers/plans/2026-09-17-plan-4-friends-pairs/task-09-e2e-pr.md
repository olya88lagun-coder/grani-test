# Task 9: Сквозные сценарии друга и пары, итоговые проверки, PR

**Files:**
- Create: `e2e/helpers.ts`, `e2e/friends.spec.ts`, `e2e/pairs.spec.ts`
- Modify: `e2e/test-flow.spec.ts` (общий помощник ответов), `docs/superpowers/plans/2026-09-17-plan-4-friends-pairs/00-overview.md` (статус)

**Interfaces:**
- Consumes: весь сайт задач 1–8 на `http://localhost:3000` с `DEV_LOGIN=1`; `GET /api/dev/login?name=`; `POST /api/results` (план 3).
- Produces: `pnpm test:e2e` с путём друга и путём пары; PR `feat/friends-pairs` → `master`.

Сценарии проверяют правила из спецификации (2.3, 4.6, 7) на живом приложении: одна отправка с браузера, сравнение только после трёх ответов, владелец не отвечает о себе; пара только с согласием, одноразовая ссылка, после выхода страница пары недоступна обоим. Каждый участник — отдельный контекст браузера (свои cookie и `localStorage`).

- [ ] **Step 1: Помощники**

`e2e/helpers.ts`:
```ts
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Тот же адрес, что в playwright.config.ts: E2E_BASE_URL позволяет гонять сценарии против второго локального сайта
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export async function answerAll(page: Page, p: { pages: number; perPage: number; label: string; submit: string }) {
  for (let screen = 1; screen <= p.pages; screen += 1) {
    await expect(page.getByRole("heading", { name: `Экран ${screen} из ${p.pages}` })).toBeVisible();
    const choices = page.getByRole("radio", { name: p.label });
    await expect(choices).toHaveCount(p.perPage);
    for (const choice of await choices.all()) await choice.check();
    await page.getByRole("button", { name: screen === p.pages ? p.submit : "Дальше" }).click();
  }
}

export const answerSelfTest = (page: Page) => answerAll(page, { pages: 10, perPage: 5, label: "Точно про меня", submit: "Узнать результат" });

// Пользователь с результатом без прохождения теста в браузере: ответы уходят в отложенную cookie, dev-вход их сохраняет
export async function signedInWithResult(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const answers = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 4]));
  const response = await page.request.post("/api/results", { data: { answers }, headers: { origin: BASE_URL } });
  expect(response.ok()).toBe(true);
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  await expect(page).toHaveURL(/\/result\/[0-9a-f-]{36}$/);
  return { context, page };
}

// Имя через пробел: на страницах показывается первое слово, а dev-вход различает пользователей по полному имени
export const uniqueName = (prefix: string) => `${prefix} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
```

В `e2e/test-flow.spec.ts` заменить цикл ответов первого сценария на `await answerSelfTest(page);` (импорт из `./helpers`), локальный `answerCurrentPage` оставить для сценария с перезагрузкой.

В `e2e/playwright.config.ts` заменить `baseURL: "http://localhost:3000"` на `baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000"`: если на 3000 уже занят другой копией сайта, сценарии запускаются с `E2E_BASE_URL=http://localhost:3001`. Там же `expect: { timeout: 15_000 }`: next dev компилирует страницу при первом заходе, и переход на ещё не открывавшуюся страницу бывает дольше 5 секунд. `browser.newContext()` в Playwright наследует `use` проекта.

- [ ] **Step 2: Путь друга**

`e2e/friends.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { answerAll, signedInWithResult, uniqueName } from "./helpers";

const answerFriendForm = (page: import("@playwright/test").Page) =>
  answerAll(page, { pages: 5, perPage: 4, label: "Скорее про меня", submit: "Отправить ответы" });

test("three friends answer anonymously and the owner sees the comparison", async ({ browser }) => {
  const owner = await signedInWithResult(browser, uniqueName("Аня"));
  await owner.page.getByRole("button", { name: "Получить ссылку для друзей" }).click();
  const link = owner.page.getByRole("textbox", { name: "Ссылка-приглашение" });
  await expect(link).toHaveValue(/\/f\/[A-Za-z0-9_-]{24}$/);
  const inviteUrl = await link.inputValue();

  // Владелец по своей ссылке отвечать не может
  await owner.page.goto(inviteUrl);
  await expect(owner.page.getByRole("heading", { name: "Это твоя ссылка" })).toBeVisible();

  const friendContexts = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(inviteUrl);
    await expect(page.getByText("просит")).toBeVisible();
    await answerFriendForm(page);
    await expect(page.getByRole("heading", { name: "Спасибо! А какой тип у тебя?" })).toBeVisible();
    friendContexts.push({ context, page });
  }

  // Второй ответ с того же браузера не принимается
  const first = friendContexts[0]!;
  await first.page.goto(inviteUrl);
  await answerFriendForm(first.page);
  // Next.js держит на странице свой пустой role="alert" для объявления переходов, поэтому ищем по тексту
  await expect(first.page.getByRole("alert").filter({ hasText: "уже ответили" })).toBeVisible();

  await owner.page.goBack();
  await owner.page.reload();
  await expect(owner.page.getByText("Ответили 3 друга")).toBeVisible();
  await expect(owner.page.locator(".compare")).toHaveCount(5);
  await expect(owner.page.getByText("Друзья", { exact: true }).first()).toBeVisible();

  for (const { context } of friendContexts) await context.close();
  await owner.context.close();
});
```

`owner.page.goBack()` возвращает со страницы «Это твоя ссылка» на результат владельца.

- [ ] **Step 3: Путь пары**

`e2e/pairs.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { answerSelfTest, BASE_URL, signedInWithResult, uniqueName } from "./helpers";

test("a partner takes the test, consents, both see the pair, leaving hides it for both", async ({ browser }) => {
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  const resultUrl = anna.page.url();
  await anna.page.getByRole("button", { name: "Позвать партнёра" }).click();
  const link = anna.page.locator(`section[data-palette="pair"]`).getByRole("textbox", { name: "Ссылка-приглашение" });
  await expect(link).toHaveValue(/\/p\/[A-Za-z0-9_-]{24}$/);
  const inviteUrl = await link.inputValue();

  const borisContext = await browser.newContext();
  const boris = await borisContext.newPage();
  await boris.goto(inviteUrl);
  await expect(boris.getByRole("heading", { name: /зовёт вас пройти тест на совместимость/ })).toBeVisible();
  await boris.getByRole("link", { name: "Пройти тест" }).click();
  await answerSelfTest(boris);
  await expect(boris).toHaveURL(/\/login$/);
  await boris.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Борис"))}`);

  // После входа партнёр возвращается к согласию, а не на свой результат
  await expect(boris).toHaveURL(inviteUrl);
  const accept = boris.getByRole("button", { name: "Узнать совместимость" });
  await expect(accept).toBeDisabled();
  await boris.getByRole("checkbox").check();
  await accept.click();
  await expect(boris).toHaveURL(/\/pair\/[0-9a-f-]{36}$/);
  const pairUrl = boris.url();
  await expect(boris.locator(".pair-score")).toHaveText(/^\d{1,3}%$/);
  // Та же мысль есть в тексте уровня совместимости, поэтому ищем дисклеймер по его продолжению
  await expect(boris.getByText("Это не прогноз отношений: число показывает", { exact: false })).toBeVisible();

  // Ссылка одноразовая, пара видна пригласившей
  await anna.page.goto(inviteUrl);
  await expect(anna.page.getByRole("heading", { name: "Ссылка уже использована" })).toBeVisible();
  await anna.page.goto(resultUrl);
  await anna.page.getByRole("link", { name: /^Пара: вы и Борис/ }).click();
  await expect(anna.page).toHaveURL(pairUrl);
  await expect(anna.page.getByText(/^Вы · Аня/)).toBeVisible();

  // Выход любого из двоих скрывает пару у обоих
  await boris.getByText("Выйти из пары", { exact: true }).first().click();
  await boris.getByRole("button", { name: "Выйти из пары" }).click();
  await expect(boris).toHaveURL(/\/result\/[0-9a-f-]{36}$/);
  expect((await anna.page.goto(pairUrl))?.status()).toBe(404);
  expect((await boris.goto(pairUrl))?.status()).toBe(404);

  await borisContext.close();
  await anna.context.close();
});

test("a pair is not created without consent", async ({ browser }) => {
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  await anna.page.getByRole("button", { name: "Позвать партнёра" }).click();
  const inviteUrl = await anna.page.locator(`section[data-palette="pair"]`).getByRole("textbox", { name: "Ссылка-приглашение" }).inputValue();
  const token = inviteUrl.split("/").at(-1);

  const vera = await signedInWithResult(browser, uniqueName("Вера"));
  const response = await vera.page.request.post("/api/pairs/accept", {
    data: { token, consent: false },
    headers: { origin: BASE_URL },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ ok: false, error: "consent_required" });
  await vera.page.goto(inviteUrl);
  await expect(vera.page.getByRole("checkbox")).toBeVisible();

  await vera.context.close();
  await anna.context.close();
});
```

Имя в dev-входе уникально (`uniqueName`), но на страницах показывается только первое слово — «Аня», «Борис».

- [ ] **Step 4: Запуск сценариев**

В трёх терминалах (в сессии Claude — фоновые процессы): `pnpm dev:db`, `pnpm dev:web`, `pnpm dev:worker` (в `apps/web/.env.development.local` — `NOTIFICATIONS_DRY_RUN=1`). Затем:
```bash
pnpm test:e2e
```
Expected: `6 passed` (3 из плана 3 + 1 друзей + 2 пары). В логе воркера — строки `dry run notification` для ответов друзей и созданной пары. При падении — отчёт `e2e/playwright-report/index.html` и trace; исправлять код приложения, а не ослаблять проверки.

- [ ] **Step 5: Итоговые проверки**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:coverage
pnpm --filter @grani/web build
pnpm --filter @grani/worker build
```
Expected: typecheck без ошибок; все тесты зелёные; покрытие `packages/*/src`, `apps/web/src/server`, `apps/web/src/lib`, `apps/worker/src` ≥ 80% по строкам, функциям, ветвям и выражениям; обе сборки без ошибок и предупреждений.

Секреты:
```bash
git diff master...HEAD | grep -nE "[0-9]{8,}:[A-Za-z0-9_-]{30,}|vk1\.a\.|^\+.*(TELEGRAM_BOT_TOKEN|SESSION_SECRET|VK_GROUP_TOKEN|VK_CALLBACK_SECRET)=" | grep -v "local-dev" || echo "no secrets"
```
Expected: `no secrets`.

Проверка безопасности по диффу `master...HEAD` (самостоятельно или агентом `security-reviewer`, если пользователь попросит):
- ни один маршрут и ни одна страница не отдают ответы отдельных друзей, в HTML страницы результата нет ответов;
- `device_hash` — HMAC, сама метка в базе не хранится;
- токены приглашений проверяются по формату до запроса к базе;
- `POST /api/pairs/accept` без согласия, по своей и по использованной ссылке ничего не создаёт;
- страница пары и выход проверяют участника; чужая пара — 404;
- `grani_pair` не позволяет перенаправить на внешний адрес (`pairReturnPath` пропускает только токен);
- Callback API проверяет `group_id` и секрет за постоянное время;
- в логах воркера нет токенов; `dry run notification` включается только переменной окружения.
CRITICAL и HIGH исправить отдельными коммитами до PR.

- [ ] **Step 6: Статус плана и коммит**

В `00-overview.md` этого плана под заголовком добавить строку `> **Статус: выполнен YYYY-MM-DD.** N тестов + 6 сквозных; покрытие: …` с числами из Step 5.

```bash
git add e2e docs/superpowers/plans/2026-09-17-plan-4-friends-pairs/00-overview.md
git commit -m "test(e2e): friend answers and pair flows end to end"
```

- [ ] **Step 7: PR (после согласия пользователя)**

Показать пользователю итог: что работает, скриншоты страницы друга, блока сравнения, страницы пары (375px), результаты проверок; напомнить, что настоящие уведомления проверяются после выкладки (план 6). Спросить разрешение на push и PR. После «да»:

```bash
git push -u origin feat/friends-pairs
gh pr create --base master --head feat/friends-pairs --title "feat: friends comparison, couple compatibility and notifications (plan 4)" --body-file <scratchpad>/pr-4.md
gh pr checks --watch --interval 20
```

Тело PR: кратко по задачам 1–9; как проверить локально (три процесса, dev-вход, инкогнито для друзей и партнёра); результаты `pnpm test:coverage` и `pnpm test:e2e`; что осталось пользователю — сообщество ВКонтакте, ключ и Callback API (план 6); что не входит (платные разборы — план 5).

Мерж — по слову пользователя.
