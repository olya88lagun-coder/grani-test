import { expect, test, type Page } from "@playwright/test";

const PATH = "/temperament";
const ITEMS = 24;

// Отвечает «Точно про меня» на все вопросы, экран за экраном
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

test("temperament test shows a result without login and keeps it after reload", async ({ page }) => {
  await page.goto(PATH);
  await answerAll(page);
  const result = page.getByTestId("short-result");
  await expect(result).toBeVisible();
  await expect(result.getByRole("heading", { level: 2 })).toHaveText(/Сангвиник|Холерик|Флегматик|Меланхолик/);
  await page.reload();
  await expect(page.getByTestId("short-result")).toBeVisible();
});

test("an attachment result does not show up on the temperament page", async ({ page }) => {
  await page.addInitScript(() => {
    const answers: Record<string, number> = {};
    for (let i = 1; i <= 15; i++) {
      const n = String(i).padStart(2, "0");
      answers[`an${n}`] = 3;
      answers[`av${n}`] = 3;
    }
    window.localStorage.setItem("grani:short:attachment:result", JSON.stringify({ v: 1, slug: "attachment", answers, at: "x" }));
  });
  await page.goto(PATH);
  await expect(page.locator(".question-card").first()).toBeVisible();
  await expect(page.getByTestId("short-result")).toHaveCount(0);
});

test("temperament page has one H1 and FAQ markup", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle(/Тест на темперамент/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((text) => text.includes('"FAQPage"'))).toBe(true);
});

test("temperament type pages exist and unknown ones are 404", async ({ page }) => {
  const ok = await page.goto(`${PATH}/kholerik`);
  expect(ok?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Холерик");
  const missing = await page.goto(`${PATH}/nope`);
  expect(missing?.status()).toBe(404);
});

test("temperament page has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(PATH);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
});

test("the site footer links to both short tests from the home page", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Тест на тип привязанности", exact: true })).toHaveAttribute("href", "/privyazannost");
  await expect(footer.getByRole("link", { name: "Тест на темперамент", exact: true })).toHaveAttribute("href", "/temperament");
});
