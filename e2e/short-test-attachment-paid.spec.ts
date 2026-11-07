import { expect, test, type Page } from "@playwright/test";
import { uniqueName } from "./helpers";

const ITEMS = 30;
const EMAIL = "anna@example.ru";

async function answerAll(page: Page) {
  for (let answered = 0; answered < ITEMS; ) {
    const cards = page.locator(".question-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i++) await cards.nth(i).getByRole("radio", { name: "Точно про меня" }).check();
    answered += count;
    await page.getByRole("button", { name: answered < ITEMS ? "Дальше" : "Узнать результат" }).click();
  }
}

test("a guest opens the attachment report: login, payment, report; a retaken test opens it without paying again", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/privyazannost");
  await answerAll(page);
  await page.getByRole("button", { name: /^Открыть личный разбор — 199/ }).click();
  await expect(page).toHaveURL(/\/login/);

  // Dev-вход читает ту же cookie с ответами, что и вход через VK
  await page.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Аня"))}`);
  await expect(page).toHaveURL(/\/short\/[0-9a-f-]{36}/);
  const firstUrl = page.url();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Личный разбор типа привязанности" })).toBeVisible();
  await expect(page.getByTestId("short-report")).toHaveCount(0);

  await page.getByRole("button", { name: /^Открыть за 199/ }).click();
  await page.getByLabel("Почта для чека").fill(EMAIL);
  await page.getByRole("button", { name: "Перейти к оплате" }).click();
  await expect(page).toHaveURL(/\/dev\/pay\/fake-/);
  await page.getByRole("button", { name: "Оплатить" }).click();
  await expect(page).toHaveURL(/\/short\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByTestId("short-report")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Упражнения на месяц" })).toBeVisible();

  // Пройти заново: уже вошедший человек сразу попадает на новый результат, и разбор открыт без оплаты
  await page.goto("/privyazannost");
  await page.getByRole("button", { name: "Пройти заново" }).click();
  await answerAll(page);
  await page.getByRole("button", { name: /^Открыть личный разбор — 199/ }).click();
  await expect(page).toHaveURL(/\/short\/[0-9a-f-]{36}/);
  expect(page.url()).not.toBe(firstUrl);
  await expect(page.getByTestId("short-report")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Открыть за 199/ })).toHaveCount(0);
});

test("someone else's saved short result is not found", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.goto("/privyazannost");
  await answerAll(page);
  await page.getByRole("button", { name: /^Открыть личный разбор — 199/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Вера"))}`);
  await expect(page).toHaveURL(/\/short\/[0-9a-f-]{36}/);
  const url = page.url();

  const other = await browser.newContext();
  const stranger = await other.newPage();
  await stranger.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Чужой"))}`);
  const response = await stranger.goto(url);
  expect(response?.status()).toBe(404);
  await other.close();
});

test("the pricing page and the offer list the attachment report at 199 rubles", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Личный разбор типа привязанности" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Личный разбор типа привязанности" })).toContainText("199");
  await page.goto("/offer");
  await expect(page.getByText(/Личный разбор типа привязанности «Грани» — 199/)).toBeVisible();
  await expect(page.getByText(/открывается сразу после оплаты/)).toBeVisible();
});

test("the paid report texts are not shipped in the test page's JavaScript", async ({ page }) => {
  await page.goto("/privyazannost");
  await expect(page.locator(".question-card").first()).toBeVisible();
  const sources = await page.evaluate(() => [...document.scripts].map((script) => script.src).filter(Boolean));
  expect(sources.length).toBeGreaterThan(0);
  for (const src of sources) {
    const body = await (await page.request.get(src)).text();
    expect(body, src).not.toContain("заработанная надёжность");
    expect(body, src).not.toContain("Факт и толкование");
  }
  expect(await page.content()).not.toContain("заработанная надёжность");
});
