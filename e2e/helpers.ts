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
