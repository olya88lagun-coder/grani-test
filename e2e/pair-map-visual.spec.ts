import { expect, test } from "@playwright/test";
import { seedReportNightFixtures } from "./report-night-fixtures";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local QA configuration required");
let fixtures: Awaited<ReturnType<typeof seedReportNightFixtures>>;
test.beforeAll(async () => { fixtures = await seedReportNightFixtures(); });
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test("reference layout has a real hero, perspective controls and eight illustrated scenarios", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "ready")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Инструкция друг к другу" })).toBeVisible();
  await expect(page.locator("#situations [data-situation-card]")).toHaveCount(8);
  await expect(page.locator(".pair-person [data-gem-dir][data-loaded=true]")).toHaveCount(2);
  if (process.env.PAIR_MAP_QA_OUTPUT) {
    const initialViewport = page.viewportSize()!;
    for (const [name,width] of [["desktop",1440],["mobile",390]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#summary").scrollIntoViewIfNeeded();
      await expect(page.locator("#situations [data-situation-card] img").first()).toHaveJSProperty("complete",true);
      await page.evaluate(() => scrollTo(0,0));
      await page.screenshot({ path: `${process.env.PAIR_MAP_QA_OUTPUT}/pair-map-${name}.png`, fullPage: true, scale: "css" });
    }
    await page.setViewportSize(initialViewport);
  }
  await page.getByRole("button", { name: "Следующая ситуация", exact: true }).click();
  await expect(page.locator("[data-situation-counter]")).toHaveText("2 / 8");
  await page.getByRole("button", { name: "Быт и порядок", exact: true }).click();
  await expect(page.locator("#situations details[open]")).toContainText("ясные обязанности");
  await page.getByRole("button", { name: /Партнёра ·/ }).click();
  await page.getByLabel("О чём говорим").selectOption("social");
  await expect(page.locator("#translator [data-translation-need]")).toContainText("время в тишине");
  for (const image of await page.locator("[data-situation-card] img").all()) {
    const source = await image.getAttribute("src");
    const response = await page.request.get(source!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
  for (let i=0;i<7;i++) await page.getByRole("button", { name: "Следующая ситуация", exact: true }).click();
  await expect(page.locator("[data-situation-counter]")).toHaveText("1 / 8");
});
