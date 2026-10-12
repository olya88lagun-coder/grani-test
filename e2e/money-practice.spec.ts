import { test, expect, type BrowserContext } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { seedMoneyFixtures } from "./money-practice-fixtures";
let fixtures: Awaited<ReturnType<typeof seedMoneyFixtures>>;
const base = process.env.MONEY_QA_BASE_URL ?? "http://127.0.0.1:4351";
const out = resolve(process.env.MONEY_QA_OUTPUT ?? "../../outputs/money-practice");
const route = (i = 0) => `/report/${fixtures[i]!.resultId}/practice/money`;
const endpoint = (i = 0) => `/api/report/${fixtures[i]!.resultId}/practice/money`;
const login = (context: BrowserContext, i = 0) => context.addCookies([{ name: "grani_session", value: fixtures[i]!.token, url: base, httpOnly: true, sameSite: "Lax" }]);
test.beforeAll(async () => {
  fixtures = await seedMoneyFixtures(); await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "local-review-session.json"), JSON.stringify({ url: base + route(), cookies: [{ name: "grani_session", value: fixtures[0]!.token, url: base, httpOnly: true, sameSite: "Lax" }] }));
});
test("six answers, four compass directions, seven-day journal and edited memo survive return", async ({ page, context }) => {
  await login(context); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(route()); await expect(page.locator("[data-money-ready]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мой финансовый компас");
  await page.screenshot({ path: resolve(out, "desktop-overview.png") });
  await page.locator("#money-questions").scrollIntoViewIfNeeded();
  for (let i = 0; i < 6; i++) { await page.locator(`input[name="money-question-${i}"][value="${i === 3 ? "c" : "a"}"]`).check(); if (i < 5) await page.getByRole("button", { name: "Следующий вопрос" }).click(); }
  await page.locator("#money-compass").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Пауза перед покупкой", exact: true }).click();
  await expect(page.locator("#money-compass")).toContainText("Зависит от ситуации");
  await page.locator("#money-compass [data-basis] summary").click(); await expect(page.locator("#money-compass")).toContainText("Часто решаю сразу");
  await page.screenshot({ path: resolve(out, "desktop-compass.png") });
  await expect(page.locator("#money-compass [data-direction]")).toHaveCount(4);
  await page.locator('input[name="money-habit"][value="pause"]').check(); await page.getByRole("button", { name: "Начать семь дней" }).click();
  await page.getByRole("checkbox", { name: "Я попробовал(а) выбранный шаг" }).check();
  await page.locator("#money-day-note").fill("После паузы покупка оказалась необязательной");
  await page.getByRole("button", { name: /День 2/ }).click(); await page.locator("#money-day-note").fill("Сегодня оставил(а) решение до завтра");
  await page.locator("#money-reflection").fill("Мне подходит пауза перед необязательными покупками");
  await page.getByRole("button", { name: "Составить мою памятку" }).click(); await expect(page.locator("#money-memo-text")).toContainText("Мне подходит пауза");
  await page.locator("#money-memo-text").fill("Мои ориентиры: одна пауза и один спокойный разговор");
  await expect(page.locator("[data-practice-save]")).toHaveText("Сохранено в аккаунте");
  await page.reload(); await expect(page.locator("[data-money-ready]")).toBeVisible();
  await expect(page.locator("#money-memo-text")).toHaveValue("Мои ориентиры: одна пауза и один спокойный разговор");
  await expect(page.getByRole("checkbox", { name: "Я попробовал(а) выбранный шаг" })).toBeChecked();
  await expect(page.locator("#money-day-note")).toHaveValue("После паузы покупка оказалась необязательной");
  await page.getByRole("button", { name: /День 2/ }).click(); await expect(page.locator("#money-day-note")).toHaveValue("Сегодня оставил(а) решение до завтра");
  await page.locator("#money-questions").scrollIntoViewIfNeeded(); await expect(page.locator('input[name="money-question-0"][value="a"]')).toBeChecked();
  await page.getByRole("button", { name: "Следующий вопрос" }).click(); await expect(page.locator('input[name="money-question-1"][value="a"]')).toBeChecked();
  await expect(page.getByText("Текст ранее созданной главы «Деньги»")).toBeVisible();
  const api = await page.request.get(endpoint()); expect(api.status()).toBe(200); expect(api.headers()["cache-control"]).toBe("private, no-store");
  for (const width of [320, 390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(out, "mobile-overview.png") });
  await page.locator("#money-week").scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(out, "mobile-week.png") });
  await page.locator("#money-compass").scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(out, "mobile-compass.png") });
  await page.getByRole("button", { name: "Свои границы", exact: true }).focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("button", { name: "Свои границы", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("old bundle unlocks pending chapter, unpaid/foreign/anonymous requests stay private", async ({ page, context }) => {
  await login(context, 1); await page.goto(route(1)); await expect(page.locator("[data-money-ready]")).toBeVisible();
  await page.goto(`/report/${fixtures[1]!.resultId}`); await expect(page.getByRole("link", { name: "Открыть мой финансовый компас" })).toBeVisible();
  expect((await page.request.get(endpoint(0))).status()).toBe(404);
  expect((await page.request.put(endpoint(0), { headers: { Origin: base }, data: { expectedRevision: 0, data: {} } })).status()).toBe(404);
  await context.clearCookies(); await login(context, 2); await page.goto(route(2)); await expect(page.getByRole("button", { name: "Глава «Деньги» — 99 ₽" })).toBeVisible();
  expect((await page.request.get(endpoint(2))).status()).toBe(403);
  await context.clearCookies(); expect((await page.request.get(endpoint())).status()).toBe(401);
  await page.goto(route()); await expect(page).toHaveURL(/\/login/);
});
test("free result follows the existing full-report prerequisite for buying a chapter", async ({ page, context }) => {
  await login(context, 3); await page.goto(route(3));
  await expect(page.getByRole("button", { name: /Полный разбор.*299/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Глава.*Деньги.*99/ })).toHaveCount(0);
});
test("reverting an edit while a committed PUT loses acknowledgement retains latest local intent", async ({ page, context }) => {
  await login(context); await page.goto(route()); await expect(page.locator("[data-money-ready]")).toBeVisible();
  await page.locator("#money-memo-text").fill("Стабильная версия A"); await expect(page.locator("[data-practice-save]")).toHaveText("Сохранено в аккаунте");
  let committed!: () => void, release!: () => void;
  const serverCommitted = new Promise<void>(r => committed = r), loseAcknowledgement = new Promise<void>(r => release = r);
  await page.route("**/api/report/**/practice/money", async intercepted => {
    if (intercepted.request().method() !== "PUT") return intercepted.continue();
    const response = await intercepted.fetch(); expect(response.status()).toBe(200); committed();
    await loseAcknowledgement; await intercepted.abort("failed");
  });
  await page.locator("#money-memo-text").fill("Записанная версия B"); await serverCommitted;
  await page.locator("#money-memo-text").fill("Стабильная версия A");
  await expect(page.locator("[data-practice-save]")).not.toHaveText("Сохранено в аккаунте");
  release(); await expect(page.locator("[data-practice-save]")).toHaveText("Сохранение не подтверждено");
  await page.unroute("**/api/report/**/practice/money"); await page.getByRole("button", { name: "Повторить сохранение" }).click();
  await expect(page.locator("[data-practice-save]")).toHaveText("Есть другая версия в аккаунте");
  expect((await (await page.request.get(endpoint())).json()).draft.data.memo).toBe("Записанная версия B");
  page.on("dialog", dialog => void dialog.accept()); await page.reload();
  await expect(page.locator("#money-memo-text")).toHaveValue("Стабильная версия A");
  await expect(page.locator("[data-practice-save]")).toHaveText("Есть другая версия в аккаунте");
});
test("bad origins, invalid payloads, oversized streams and unimplemented chapters are rejected", async ({ page, context }) => {
  await login(context, 1);
  expect((await page.request.put(endpoint(1), { headers: { Origin: "https://example.invalid" }, data: {} })).status()).toBe(403);
  expect((await page.request.put(endpoint(1), { headers: { Origin: base }, data: { expectedRevision: 0, data: { notes: [] } } })).status()).toBe(400);
  expect((await page.request.put(endpoint(1), { headers: { Origin: base, "Content-Type": "application/json" }, data: "x".repeat(129 * 1024) })).status()).toBe(413);
  expect((await page.request.get(`/api/report/${fixtures[1]!.resultId}/practice/stress`)).status()).toBe(404);
});
test("offline edits survive reload and a stale tab cannot overwrite newer progress", async ({ page, context }) => {
  await login(context); await page.goto(route()); await expect(page.locator("[data-money-ready]")).toBeVisible();
  const second = await context.newPage(); await second.goto(route()); await expect(second.locator("[data-money-ready]")).toBeVisible();
  await page.locator("#money-memo-text").fill("Первая вкладка"); await expect(page.locator("[data-practice-save]")).toHaveText("Сохранено в аккаунте");
  await second.locator("#money-memo-text").fill("Вторая вкладка"); await expect(second.locator("[data-practice-save]")).toHaveText("Есть другая версия в аккаунте");
  expect((await (await page.request.get(endpoint())).json()).draft.data.memo).toBe("Первая вкладка");
  second.on("dialog", d => void d.accept()); await second.getByRole("button", { name: "Загрузить версию из аккаунта" }).click();
  await expect(second.locator("#money-memo-text")).toHaveValue("Первая вкладка"); await second.close();
  await page.route("**/api/report/**/practice/money", route => route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue());
  await page.locator("#money-memo-text").fill("Моя заметка без сети"); await expect(page.locator("[data-practice-save]")).toHaveText("Сохранение не подтверждено");
  page.on("dialog", d => void d.accept()); await page.reload(); await expect(page.locator("#money-memo-text")).toHaveValue("Моя заметка без сети");
  await expect(page.locator("[data-practice-save]")).toHaveText("Сохранение не подтверждено");
  await page.unroute("**/api/report/**/practice/money"); await page.getByRole("button", { name: "Повторить сохранение" }).click();
  await expect(page.locator("[data-practice-save]")).toHaveText("Сохранено в аккаунте"); await page.reload(); await expect(page.locator("#money-memo-text")).toHaveValue("Моя заметка без сети");
});
test("uncertain equal recovery is reconciled when an abandoned write commits after reload", async ({ page, context }) => {
  await login(context); await page.goto(route()); await expect(page.locator("[data-money-ready]")).toBeVisible();
  await page.locator("#money-memo-text").fill("Подтверждённая версия A"); await expect(page.locator("[data-practice-save]")).toHaveText("Сохранено в аккаунте");
  let releaseOld!: () => void, observed!: () => void;
  let oldBody: {expectedRevision: number; data: unknown};
  const oldStarted = new Promise<void>(r => observed = r), dropOld = new Promise<void>(r => releaseOld = r);
  await page.route("**/api/report/**/practice/money", async intercepted => {
    if (intercepted.request().method() !== "PUT") return intercepted.continue();
    oldBody = intercepted.request().postDataJSON(); observed(); await dropOld; await intercepted.abort("failed");
  });
  await page.locator("#money-memo-text").fill("Поздняя версия B"); await oldStarted;
  await page.locator("#money-memo-text").fill("Подтверждённая версия A"); releaseOld();
  await expect(page.locator("[data-practice-save]")).toHaveText("Сохранение не подтверждено");
  await page.unroute("**/api/report/**/practice/money");
  let releaseRecovery!: () => void;
  const resumeRecovery = new Promise<void>(r => releaseRecovery = r);
  await page.route("**/api/report/**/practice/money", async intercepted => {
    if (intercepted.request().method() !== "PUT") return intercepted.continue();
    await resumeRecovery; await intercepted.continue();
  });
  page.on("dialog", dialog => void dialog.accept()); await page.reload();
  await expect(page.locator("[data-practice-save]")).toHaveText("Сохраняем…");
  // Emulate backend completion of the earlier request after the new page's GET.
  const late = await page.request.put(endpoint(), {headers: {Origin: base}, data: oldBody!}); expect(late.status()).toBe(200);
  releaseRecovery(); await expect(page.locator("[data-practice-save]")).toHaveText("Есть другая версия в аккаунте");
  await expect(page.locator("#money-memo-text")).toHaveValue("Подтверждённая версия A");
  expect((await (await page.request.get(endpoint())).json()).draft.data.memo).toBe("Поздняя версия B");
});
