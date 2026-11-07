import { expect, test, type Page } from "@playwright/test";

const PATH = "/privyazannost";
const ITEMS = 30;

// Отвечает «Точно про меня» на все вопросы, экран за экраном
async function answerAll(page: Page) {
  for (let answered = 0; answered < ITEMS; ) {
    const cards = page.locator(".question-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i++) await cards.nth(i).getByRole("radio", { name: "Точно про меня" }).check();
    answered += count;
    const next = page.getByRole("button", { name: answered < ITEMS ? "Дальше" : "Узнать результат" });
    await next.click();
  }
}

test("attachment test shows a result without login and keeps answers in the browser", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(`${new URL(request.url()).pathname} ${request.postData() ?? ""}`);
  });
  await page.goto(PATH);
  await answerAll(page);

  const result = page.getByTestId("short-result");
  await expect(result).toBeVisible();
  await expect(result.getByRole("heading", { level: 2 })).toContainText("тип привязанности");
  await expect(result).toContainText("%");
  await expect.poll(() => posts.some((p) => p.startsWith("/api/funnel attachment_finish"))).toBe(true);
  // Кроме счётчика воронки, никаких запросов с ответами
  expect(posts.filter((p) => !p.startsWith("/api/funnel"))).toEqual([]);

  await page.reload();
  await expect(page.getByTestId("short-result")).toBeVisible();

  await page.getByRole("button", { name: "Пройти заново" }).click();
  await expect(page.locator(".question-card").first()).toBeVisible();
});

test("attachment test works when localStorage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await page.goto(PATH);
  await answerAll(page);
  await expect(page.getByTestId("short-result")).toBeVisible();
});

test("a corrupted stored result shows the test again without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.localStorage.setItem("grani:short:attachment:result", '{"v":1,"slug":"attachment","answers":{"an01":9}}');
  });
  await page.goto(PATH);
  await expect(page.locator(".question-card").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("attachment page is indexable, has one H1, FAQ markup and server-rendered text", async ({ page, browser }) => {
  await page.goto(PATH);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle(/Тест на тип привязанности/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((text) => text.includes('"FAQPage"'))).toBe(true);

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const raw = await noJs.newPage();
  await raw.goto(PATH);
  await expect(raw.getByRole("heading", { name: "Две оси: тревожность и избегание" })).toBeVisible();
  await noJs.close();
});

test("attachment type pages exist and unknown ones are 404", async ({ page }) => {
  const ok = await page.goto(`${PATH}/nadezhnyy`);
  expect(ok?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Надёжный тип привязанности");
  const missing = await page.goto(`${PATH}/nope`);
  expect(missing?.status()).toBe(404);
});

test("attachment page has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(PATH);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
});
