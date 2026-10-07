import { expect, test } from "@playwright/test";

test("the account action stays inside the header at intermediate widths", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const path of ["/big-five-test", "/articles"]) {
    await page.goto(path);
    const account = page.getByRole("banner").getByRole("link", { name: "Войти", exact: true });
    await expect(account).toBeVisible();
    const box = await account.boundingBox();
    const contentWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(contentWidth + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(contentWidth + 1);
  }
});

test("every home type action fits and has its own space below the description", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const cards = page.locator(".home-type-card");
  await expect(cards).toHaveCount(5);
  const contentWidth = await page.evaluate(() => document.documentElement.clientWidth);
  for (const card of await cards.all()) {
    const action = await card.getByRole("link").boundingBox();
    const description = await card.locator("p").boundingBox();
    expect(action).not.toBeNull();
    expect(description).not.toBeNull();
    expect(action!.x + action!.width).toBeLessThanOrEqual(contentWidth + 1);
    expect(action!.y).toBeGreaterThanOrEqual(description!.y + description!.height - 1);
  }
});

test("mobile navigation opens with the keyboard, closes with Escape and follows links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const header = page.locator("header").filter({ has: page.getByRole("link", { name: "Грани — на главную" }) });
  const menu = header.locator("summary");
  const navigation = header.getByRole("navigation", { name: "Основная навигация" });
  await expect(navigation).not.toBeVisible();
  await menu.focus();
  await menu.press("Enter");
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Статьи", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await navigation.getByRole("link", { name: "О проекте", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("О проекте и методике");
  await expect(page.getByRole("navigation", { name: "Основная навигация" })).not.toBeVisible();
  const currentMenu = page.locator("header summary");
  await currentMenu.click();
  await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "О проекте", exact: true }).press("Enter");
  await expect(currentMenu).toBeFocused();
  await expect(page.locator("header details")).not.toHaveAttribute("open");
});

test("compact headers also fit the signed-in account label", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { signedIn: true } }));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/big-five-test");
  const account = page.getByRole("banner").getByRole("link", { name: "Мой профиль", exact: true });
  await expect(account).toBeVisible();
  const box = await account.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth) + 1);
});
