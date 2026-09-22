# Task 11: Сквозные сценарии оплаты, итоговые проверки, PR

**Files:**
- Create: `e2e/purchase.spec.ts`
- Modify: `docs/superpowers/plans/2026-09-22-plan-5-paid-reports/00-overview.md` (статус)

**Interfaces:**
- Consumes: весь сайт задач 1–10 с `DEV_LOGIN=1`, `PAYMENTS_FAKE=1`; воркер с `AI_PROVIDER=none`, `NOTIFICATIONS_DRY_RUN=1`; `signedInWithResult`, `uniqueName`, `BASE_URL` (`e2e/helpers.ts`, план 4).
- Produces: `pnpm test:e2e` с путями оплаты; PR `feat/paid-reports` → `master`.

Раздел 7 спецификации: тест → вход → бесплатный результат → оплата → разбор. Вместо тестового магазина ЮKassa — поддельный шлюз: настоящий магазин проверяется вручную при выкладке (план 6). Генерацию делает воркер, поэтому для сценариев нужны три процесса: `dev:db`, `dev:web`, `dev:worker`. Разбор собирается из блоков примерно за секунду, но ожидания на переходы — до 60 секунд: воркер опрашивает очередь раз в несколько секунд, а `next dev` компилирует новые страницы.

- [ ] **Step 1: Сценарии**

`e2e/purchase.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";
import { BASE_URL, signedInWithResult, uniqueName } from "./helpers";

const GENERATION_TIMEOUT = 60_000;

async function payOnFakePage(page: Page) {
  await expect(page).toHaveURL(/\/dev\/pay\/fake-/);
  await page.getByRole("button", { name: "Оплатить" }).click();
}

test("buys the full report and all chapters, sees them generated", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await signedInWithResult(browser, uniqueName("Аня"));
  const resultUrl = page.url();

  await expect(page.getByRole("heading", { name: "Что откроется в полном разборе" })).toBeVisible();
  await page.getByRole("button", { name: /^Открыть за 299/ }).click();
  await payOnFakePage(page);
  await expect(page).toHaveURL(/\/report\/[0-9a-f-]{36}$/, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Портрет" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Как со мной работать" })).toBeVisible();
  await expect(page.getByText("Ответили 0 из 3")).toBeVisible();
  await expect(page.getByText("Материалы для самопознания, не психологическая и не медицинская диагностика.")).toBeVisible();

  await page.getByRole("button", { name: /^Все четыре главы/ }).click();
  await payOnFakePage(page);
  await expect(page).toHaveURL(/\/report\//, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByText("Готовим главу", { exact: false })).toHaveCount(0, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("button", { name: /^Глава «/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Все четыре главы/ })).toHaveCount(0);

  // На результате вместо превью — ссылка на разбор, покупка второй раз не предлагается
  await page.goto(resultUrl);
  await expect(page.getByRole("heading", { name: "Разбор открыт" })).toBeVisible();

  const card = await page.request.get(`${resultUrl.replace("/result/", "/cards/manual/")}`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");

  await context.close();
});

test("a canceled payment opens nothing", async ({ browser }) => {
  const { context, page } = await signedInWithResult(browser, uniqueName("Вера"));
  const resultId = page.url().split("/").at(-1)!;

  await page.getByRole("button", { name: /^Открыть за 299/ }).click();
  await expect(page).toHaveURL(/\/dev\/pay\/fake-/);
  await page.getByRole("button", { name: "Отменить" }).click();

  await expect(page.getByRole("heading", { name: "Оплата не прошла" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await page.goto(`/report/${resultId}`);
  await expect(page).toHaveURL(new RegExp(`/result/${resultId}$`));

  await context.close();
});

test("one payment opens the pair report to both, the price comes from the server", async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  const invite = await anna.page.request.post("/api/pairs/invites", { data: { resultId: anna.page.url().split("/").at(-1) }, headers: { origin: BASE_URL } });
  const token = ((await invite.json()) as { url: string }).url.split("/").at(-1);
  const boris = await signedInWithResult(browser, uniqueName("Борис"));
  const accepted = await boris.page.request.post("/api/pairs/accept", { data: { token, consent: true }, headers: { origin: BASE_URL } });
  const pairUrl = ((await accepted.json()) as { redirect: string }).redirect;

  // Клиент не может задать сумму: лишние поля тела игнорируются, цена — из прайса
  const tampered = await boris.page.request.post("/api/purchases", {
    data: { product: "pair", targetId: pairUrl.split("/").at(-1), amountKopecks: 100 },
    headers: { origin: BASE_URL },
  });
  const payUrl = ((await tampered.json()) as { url: string }).url;
  await boris.page.goto(payUrl);
  await expect(boris.page.getByRole("heading", { name: "399 ₽" })).toBeVisible();
  await boris.page.getByRole("button", { name: "Оплатить" }).click();

  await expect(boris.page).toHaveURL(new RegExp(`${pairUrl}$`), { timeout: GENERATION_TIMEOUT });
  await expect(boris.page.getByRole("heading", { name: "В чём вы похожи" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await expect(boris.page.getByRole("button", { name: /^Личный разбор/ })).toBeVisible();

  await anna.page.goto(pairUrl);
  await expect(anna.page.getByRole("heading", { name: "В чём вы похожи" })).toBeVisible();
  await expect(anna.page.getByRole("button", { name: /^Открыть разбор пары/ })).toHaveCount(0);

  await anna.context.close();
  await boris.context.close();
});
```

`formatRub` ставит неразрывный пробел, а `getByRole({ name })` сравнивает имя с нормализацией пробелов, поэтому «399 ₽» в ожидании совпадает.

- [ ] **Step 2: Запуск сценариев**

В трёх фоновых процессах: `pnpm dev:db`, `pnpm dev:web`, `pnpm dev:worker` (в `apps/web/.env.development.local` — `PAYMENTS_FAKE=1`, `AI_PROVIDER=none`, `NOTIFICATIONS_DRY_RUN=1`, `DATABASE_POOL_MAX=1`). Если на 3000 уже работает другая копия сайта — запускать с `E2E_BASE_URL` (план 4, Task 9).
```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm test:e2e
```
Expected: `9 passed` (6 из плана 4 + 3 оплаты). В логе воркера — `report generated` для `full`, четырёх глав и `pair`, и `dry run notification` «Готово: …». При падении — отчёт `e2e/playwright-report/index.html`; исправлять приложение, а не ослаблять проверки.

- [ ] **Step 3: Итоговые проверки**

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
git diff master...HEAD | grep -nE "[0-9]{8,}:[A-Za-z0-9_-]{30,}|vk1\.a\.|(live|test)_[A-Za-z0-9_-]{20,}|AQVN[A-Za-z0-9_-]{20,}|^\+.*(YOOKASSA_SECRET_KEY|YANDEX_API_KEY|GIGACHAT_AUTH_KEY|SESSION_SECRET|TELEGRAM_BOT_TOKEN)=" | grep -v "local-dev" || echo "no secrets"
```
Expected: `no secrets` (в тестах только заглушки вида `test_secret`, `key`, `live_x` — короче 20 знаков).

Проверка безопасности по диффу `master...HEAD`:
- сумма платежа берётся только из `PRODUCT_PRICES` (сценарий с `amountKopecks: 100` это подтверждает);
- покупка возможна только для своего результата и своей активной пары;
- статус меняет только `syncPayment` по ответу API; сверяются `purchase_id` и сумма; переход `pending → succeeded` условный, задачи ставятся один раз;
- `/api/yookassa/notification` принимает только IP ЮKassa и при поддельном шлюзе выключен; поддельный шлюз невозможен в production;
- во входе модели нет имён, пола и идентификаторов; в логе нет текстов ответов модели и ключей;
- разбор, страница разбора и карточка «инструкция» доступны только владельцу; разбор пары — только участникам активной пары;
- в HTML бесплатного результата нет текста платного разбора (только первые строки из блоков).
CRITICAL и HIGH исправить отдельными коммитами до PR.

- [ ] **Step 4: Статус плана и коммит**

В `00-overview.md` этого плана под заголовком добавить строку `> **Статус: выполнен YYYY-MM-DD.** N тестов + 9 сквозных; покрытие: …` с числами из Step 3.

```bash
git add e2e docs/superpowers/plans/2026-09-22-plan-5-paid-reports/00-overview.md
git commit -m "test(e2e): paid report, chapters, canceled payment and pair report end to end"
```

- [ ] **Step 5: PR (после согласия пользователя)**

Показать пользователю итог: что работает, скриншоты превью на результате, страницы разбора и разбора пары (375px), результаты проверок; напомнить, что настоящая оплата, чек «Мой налог» и ИИ проверяются после выкладки (план 6) и что для этого нужны магазин ЮKassa и ключ YandexGPT или GigaChat. Спросить разрешение на push и PR. После «да»:

```bash
git push -u origin feat/paid-reports
gh pr create --base master --head feat/paid-reports --title "feat: paid reports with YooKassa, AI generation with a library fallback (plan 5)" --body-file <scratchpad>/pr-5.md
gh pr checks --watch --interval 20
```

Тело PR: кратко по задачам 1–11; как проверить локально (три процесса, поддельная оплата, `AI_PROVIDER=none`); результаты `pnpm test:coverage` и `pnpm test:e2e`; что осталось пользователю — магазин ЮKassa, ключи ИИ, сертификат для GigaChat, финальная оферта и политика (план 6).

Мерж — по слову пользователя.
