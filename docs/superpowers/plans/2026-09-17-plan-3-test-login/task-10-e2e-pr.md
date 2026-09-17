# Task 10: Сквозной сценарий, итоговые проверки, PR

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/test-flow.spec.ts`
- Modify: `package.json` (`@playwright/test`, скрипт `test:e2e`), `.gitignore`, `docs/superpowers/plans/2026-09-17-plan-3-test-login/00-overview.md` (статус)

**Interfaces:**
- Consumes: весь сайт задач 3–9 на `http://localhost:3000` с `DEV_LOGIN=1`; `GET /api/dev/login?name=` (Task 6).
- Produces: `pnpm test:e2e` — проверка главного пути человека; PR `feat/test-login` → `master`.

Сквозной сценарий проверяет то, что не видно модульным тестам: связку `localStorage` → `POST /api/results` → cookie `grani_pending` → вход → сохранённый результат → карточка. Ответ «Точно про меня» на все 50 вопросов даёт баллы O70 C60 E50 A60 S20 (Task 5), то есть тип `++++` «Вдохновитель» с уточнением «Чувствительность».

- [ ] **Step 1: Playwright**

```bash
cd /c/dev/grani-test
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm add -Dw @playwright/test@1.63.0
```

В корневой `package.json` в `scripts` добавить `"test:e2e": "playwright test -c e2e/playwright.config.ts"`. В `.gitignore` добавить:
```
e2e/test-results/
e2e/playwright-report/
```

`e2e/playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

// Только локальное приложение: dev-вход работает лишь с DEV_LOGIN=1 и не в production.
// Браузер — установленный Chrome: CDN со сборками Playwright с машины разработчика недоступен.
export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  use: { baseURL: "http://localhost:3000", locale: "ru-RU", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
});
```

- [ ] **Step 2: Сценарий**

`e2e/test-flow.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";

const PAGES = 10;

async function answerCurrentPage(page: Page, label: string) {
  const choices = page.getByRole("radio", { name: label });
  await expect(choices).toHaveCount(5);
  for (const choice of await choices.all()) await choice.check();
}

test("passes the test, logs in and sees the saved result with a story card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Пройти тест" }).click();
  await expect(page).toHaveURL(/\/test$/);

  for (let screen = 1; screen <= PAGES; screen += 1) {
    await expect(page.getByRole("heading", { name: `Экран ${screen} из ${PAGES}` })).toBeVisible();
    const next = page.getByRole("button", { name: screen === PAGES ? "Узнать результат" : "Дальше" });
    await expect(next).toBeDisabled();
    await answerCurrentPage(page, "Точно про меня");
    await next.click();
  }

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Результат посчитан")).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Продолжить" })).toBeDisabled();

  // Настоящий виджет Telegram на localhost не работает — вход через dev-маршрут с теми же cookie
  await page.goto(`/api/dev/login?name=e2e-${Date.now()}`);
  await expect(page).toHaveURL(/\/result\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Вдохновитель" })).toBeVisible();
  await expect(page.getByText("Чувствительность", { exact: true })).toBeVisible();
  await expect(page.getByText("Эмоциональная устойчивость", { exact: true })).toBeVisible();

  const card = page.getByRole("img", { name: "Карточка типа «Вдохновитель»" });
  await expect(card).toBeVisible();
  const cardResponse = await page.request.get("/cards/pppp");
  expect(cardResponse.status()).toBe(200);
  expect(cardResponse.headers()["content-type"]).toBe("image/png");

  await page.goto("/me");
  await expect(page).toHaveURL(/\/result\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login$/);
});

test("keeps answers after a reload in the middle of the test", async ({ page }) => {
  await page.goto("/test");
  await answerCurrentPage(page, "Отчасти");
  await page.getByRole("button", { name: "Дальше" }).click();
  await answerCurrentPage(page, "Скорее про меня");
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByRole("heading", { name: "Экран 3 из 10" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Экран 3 из 10" })).toBeVisible();
  await expect(page.getByText("Ответов: 10 из 50")).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  for (const choice of await page.getByRole("radio", { name: "Скорее про меня" }).all()) await expect(choice).toBeChecked();
});

test("unknown card and foreign result are not found", async ({ page }) => {
  expect((await page.request.get("/cards/xxxx")).status()).toBe(404);
  await page.goto(`/api/dev/login?name=e2e-stranger-${Date.now()}`);
  const response = await page.goto("/result/00000000-0000-0000-0000-000000000000");
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 3: Запуск сценария**

В двух терминалах (в сессии Claude — фоновые процессы или `preview_start`):
```bash
pnpm dev:db
```
```bash
pnpm dev:web
```
Затем:
```bash
pnpm test:e2e
```
Expected: `3 passed`. При падении открыть `e2e/playwright-report/index.html` и trace, исправить код приложения (не ослаблять проверки сценария), перезапустить.

Остановить dev-серверы.

- [ ] **Step 4: Итоговые проверки**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:coverage
pnpm --filter @grani/web build
```
Затем проверить карточку в собранном приложении (шрифты должны попасть в standalone):
```bash
cp -r apps/web/public apps/web/.next/standalone/apps/web/ && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
(cd apps/web/.next/standalone/apps/web && set -a && . ../../../../.env.development.local && set +a && PORT=3100 node server.js) &
curl -s -o /dev/null -w "%{http_code} %{content_type}
" http://localhost:3100/cards/pppp
kill %1
```
Expected: `200 image/png`.

Expected от команд выше: typecheck без ошибок; все тесты зелёные; покрытие `packages/*/src`, `apps/web/src/server`, `apps/web/src/lib` ≥ 80% по строкам, функциям, ветвям и выражениям; `next build` собирается без ошибок (сборке нужен `apps/web/.env.development.local` или переменные из `.env.development.example` в окружении).

Проверить отсутствие секретов в коммитах ветки:
```bash
git diff master...HEAD | grep -nE "[0-9]{8,}:[A-Za-z0-9_-]{30,}|^\+.*(TELEGRAM_BOT_TOKEN|SESSION_SECRET)=" | grep -v "local-dev" || echo "no secrets"
```
Expected: `no secrets` (в репозитории только значения из `.env.development.example`).

Проверка безопасности входа и данных — агент `security-reviewer` по диффу `master...HEAD`: вход Telegram и VK, cookie, согласие, `POST /api/results`, `POST /api/consent`, выход, доступ к `/result/[id]`. CRITICAL и HIGH исправить отдельными коммитами до PR.

- [ ] **Step 5: Статус плана**

В `00-overview.md` этого плана под заголовком добавить строку `> **Статус: выполнен YYYY-MM-DD.** N тестов + 3 сквозных; покрытие: …` с числами из Step 4.

```bash
git add package.json pnpm-lock.yaml .gitignore e2e docs/superpowers/plans/2026-09-17-plan-3-test-login/00-overview.md
git commit -m "test(e2e): test flow from landing to saved result and story card"
```

- [ ] **Step 6: PR (после согласия пользователя)**

Показать пользователю итог: что работает, скриншоты первого экрана, страницы результата и карточки (375px), результаты проверок. Спросить разрешение на push и PR. После «да»:

```bash
git push -u origin feat/test-login
gh pr create --base master --head feat/test-login --title "feat: test, login and free result (plan 3)" --body-file <scratchpad>/pr-3.md
```

Тело PR (`pr-3.md`): кратко по задачам 1–10; как проверить локально (`pnpm dev:db`, `pnpm dev:web`, `/api/dev/login`); результаты `pnpm test:coverage` и `pnpm test:e2e`; что осталось пользователю — бот, приложение VK ID, DNS (если ещё не сделано); что не входит (планы 4–6).

Дождаться зелёного CI в PR. Мерж — по слову пользователя.
