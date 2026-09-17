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
