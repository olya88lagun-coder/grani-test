import { expect, test } from "@playwright/test";
import { answerSelfTest } from "./helpers";

const submitButton = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^(Узнать результат|Отправляем…)$/ });

test("a network failure while sending keeps the answers and lets the person try again", async ({ page }) => {
  await page.goto("/test");
  await page.route("**/api/results", (route) => route.abort());
  await answerSelfTest(page);

  await expect(page.locator("p.error")).toContainText("Не получилось отправить ответы");
  await expect(page.getByRole("button", { name: "Узнать результат" })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Ответов: 50 из 50")).toBeVisible();

  await page.unroute("**/api/results");
  await page.getByRole("button", { name: "Узнать результат" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a server error, a rate limit and an unreadable answer are all shown without losing anything", async ({ page }) => {
  await page.goto("/test");
  await page.route("**/api/results", (route) => route.fulfill({ status: 500, contentType: "text/html", body: "<html>boom</html>" }));
  await answerSelfTest(page);
  await expect(page.locator("p.error")).toContainText("Не получилось отправить ответы");

  await page.unroute("**/api/results");
  await page.route("**/api/results", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, error: "rate_limited" }) }));
  await page.getByRole("button", { name: "Узнать результат" }).click();
  await expect(page.locator("p.error")).toContainText("Слишком много попыток");
  await expect(page.getByText("Ответов: 50 из 50")).toBeVisible();
});

test("a double click on the final button sends the answers once", async ({ page }) => {
  await page.goto("/test");
  let requests = 0;
  await page.route("**/api/results", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await answerSelfTest(page);
  // answerSelfTest уже нажал кнопку один раз; ещё два быстрых щелчка по ней не должны отправить ответы повторно
  const button = submitButton(page);
  await button.dblclick({ force: true }).catch(() => undefined);
  await expect(page).toHaveURL(/\/login$/);
  expect(requests).toBe(1);
});

test("answers survive leaving the test and coming back, and are gone after a successful send", async ({ page }) => {
  await page.goto("/test");
  const first = page.getByRole("radio", { name: "Точно про меня" });
  await expect(first).toHaveCount(5);
  for (const radio of await first.all()) await radio.check();
  await expect(page.getByText("Ответов: 5 из 50")).toBeVisible();

  await page.goto("/about");
  await page.goBack();
  await expect(page.getByText("Ответов: 5 из 50")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Экран 2 из 10" })).toBeVisible();

  await page.getByRole("button", { name: "Назад" }).click();
  await answerSelfTest(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/test");
  await expect(page.getByText("Ответов: 0 из 50")).toBeVisible();
});

test("a browser that refuses to store progress says so", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("denied", "QuotaExceededError");
    };
  });
  await page.goto("/test");
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByRole("radio", { name: "Точно про меня" }).first().check();

  await expect(page.getByRole("status")).toContainText("Браузер не сохраняет прогресс");
});
