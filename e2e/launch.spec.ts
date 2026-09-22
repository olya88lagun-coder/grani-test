import { expect, test } from "@playwright/test";
import { signedInWithResult, uniqueName } from "./helpers";

test("public pages are indexable and private ones are not", async ({ page, request }) => {
  await page.goto("/types/iskra");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Искра");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await page.getByRole("link", { name: /Пройти тест/ }).first().click();
  await expect(page).toHaveURL(/\/test$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap.match(/<loc>/g)).toHaveLength(39);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /result/");
  expect((await request.get("/types/unknown")).status()).toBe(404);
});

test.describe("cookie banner", () => {
  // Без заранее сделанного выбора — как у нового посетителя
  test.use({ storageState: { cookies: [], origins: [] } });

  test("loads nothing until accepted and can be reopened from the footer", async ({ page }) => {
    const metrika: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("mc.yandex")) metrika.push(request.url());
    });
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Cookie" });
    await banner.getByRole("button", { name: "Только необходимые" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner).toBeHidden();
    await page.getByRole("button", { name: "Настройки cookie" }).click();
    await expect(banner).toBeVisible();
    expect(metrika).toEqual([]);
  });
});

test("a user deletes their data and loses access to the result", async ({ browser }) => {
  const { context, page } = await signedInWithResult(browser, uniqueName("Удаляемая"));
  const resultUrl = page.url();
  await page.getByRole("link", { name: "Удалить мои данные" }).click();
  const remove = page.getByRole("button", { name: "Удалить навсегда" });
  await expect(remove).toBeDisabled();
  await page.getByLabel(/без возможности восстановления/).check();
  await remove.click();
  await expect(page.getByText("Данные удалены")).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(resultUrl);
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test("documents are linked from the footer of public pages", async ({ page }) => {
  for (const path of ["/", "/types", "/compatibility", "/articles"]) {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    for (const name of ["Контакты и услуги", "Оферта", "Политика обработки данных", "Согласие"]) {
      await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
    }
  }
  await page.goto("/contacts");
  await expect(page.getByText(/ИНН \d{12}/)).toBeVisible();
});
