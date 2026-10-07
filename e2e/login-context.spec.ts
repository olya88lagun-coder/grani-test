import { expect, test } from "@playwright/test";
import { answerSelfTest, BASE_URL } from "./helpers";

const TOKEN = "AbC123xyz_-AbC123xyz_-AB";
const title = (page: import("@playwright/test").Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true });

test("a plain visit to the sign-in page gets the plain intro", async ({ page }) => {
  await page.goto("/login");

  await expect(title(page, "Войди в «Грани»")).toBeVisible();
  await expect(page.getByText("Здесь можно вернуться к своему результату и продолжить знакомство с собой")).toBeVisible();
  await expect(page.getByText("Результат посчитан")).toHaveCount(0);
});

test("after a finished test the intro talks about seeing the result, and only then", async ({ page }) => {
  await page.goto("/test");
  await answerSelfTest(page);

  await expect(page).toHaveURL(/\/login$/);
  await expect(title(page, "Осталось увидеть результат")).toBeVisible();
  await expect(page.getByText("Войди, чтобы увидеть свой тип личности и пять ключевых черт")).toBeVisible();
});

test("coming from Together gives the Together intro, for the space and for an invite alike, and sign-in returns to the first action", async ({ page }) => {
  await page.goto("/api/together/enter?next=space");
  await expect(page).toHaveURL(/\/login$/);
  await expect(title(page, "Продолжим во «Вдвоём»")).toBeVisible();
  await expect(page.getByText("Войди, чтобы продолжить в пространстве «Грани. Вдвоём»")).toBeVisible();

  await page.goto(`/api/together/enter?next=invite&token=${TOKEN}`);
  await expect(title(page, "Продолжим во «Вдвоём»")).toBeVisible();

  await page.goto(`/api/dev/login?name=${encodeURIComponent(`Контекст ${Date.now()}`)}`);
  await expect(page).toHaveURL(new RegExp(`/together/invite/${TOKEN}$`));
});

test("Together beats a finished test when both are present, and a tampered cookie gives nothing", async ({ page, context }) => {
  await page.goto("/test");
  await answerSelfTest(page);
  await page.goto("/api/together/enter?next=space");
  await expect(title(page, "Продолжим во «Вдвоём»")).toBeVisible();

  await context.clearCookies();
  await context.addCookies([{ name: "grani_together", value: "https://evil.example", url: BASE_URL }]);
  await page.goto("/login");
  await expect(title(page, "Войди в «Грани»")).toBeVisible();
});
