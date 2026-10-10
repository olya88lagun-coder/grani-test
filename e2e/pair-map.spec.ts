import { expect, test } from "@playwright/test";
import { seedReportNightFixtures } from "./report-night-fixtures";
import { randomUUID } from "node:crypto";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local QA configuration required");
let fixtures: Awaited<ReturnType<typeof seedReportNightFixtures>>;
test.beforeAll(async () => { fixtures = await seedReportNightFixtures(); });
test.beforeEach(async({context})=>context.setExtraHTTPHeaders({"x-forwarded-for":`2001:db8::${randomUUID().slice(0,4)}`}));
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test("paid map uses both real perspectives, edits drafts, and survives reload", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "ready")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.getByRole("heading", { name: "Инструкция друг к другу", exact: true })).toBeVisible();
  await expect(page.locator("[role=meter]")).toHaveCount(10);
  await expect(page.locator(".pair-score")).toHaveText("63%");
  await expect(page.getByRole("navigation", { name: "Разделы карты пары" })).toBeVisible();
  await page.getByRole("button", { name: "Общение и отдых", exact: true }).click();
  await expect(page.locator("#situations details[open]")).toContainText("совместное общение");
  await page.getByRole("button", { name: /Партнёра ·/ }).click();
  await expect(page.locator("#situations details[open]")).toContainText("время в тишине");
  await page.getByLabel("О чём говорим").selectOption("social");
  await expect(page.locator("#translator [data-translation-need]")).toContainText("время в тишине");
  await page.getByRole("button", { name: /04.*Выберите маленький шаг/ }).click();
  await expect(page.locator("#conversation")).toContainText("Шаг 4 из 4");
  await page.getByLabel("Я согласен(на) на хранение и раскрытие ответов карты пары").check();
  await page.getByRole("button", { name: "Принять отдельное согласие" }).click();
  await page.getByLabel("01 Как мы спорим").fill("Тестовый черновик: пауза 20 минут.");
  await page.locator("[data-agreement-slot='0']").getByRole("button", { name: "Сохранить личный черновик", exact: true }).click();
  await expect(page.getByText("Личный черновик договорённости сохранён.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("01 Как мы спорим")).toHaveValue("Тестовый черновик: пауза 20 минут.");
  await expect(page.getByText("Скачивание пока недоступно.", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test("one purchase opens the same map to the second participant with their own profile first", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "ready")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[1]!.token, url: baseURL }]);
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.getByRole("button", { name: /Моя · Тихая/ })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Вы: Экстраверсия" })).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByRole("button", { name: /Открыть разбор пары/ })).toHaveCount(0);
  await expect(page.getByLabel("01 Как мы спорим")).not.toHaveValue("Тестовый черновик: пауза 20 минут.");
});

test("unpaid server response withholds all interactive paid content", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "available")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  const response = await page.goto(`/pair/${pair.pairId}`);
  await expect(page.getByRole("button", { name: /Открыть разбор пары за 399/ })).toBeVisible();
  await expect(page.getByRole("meter")).toHaveCount(10);
  await expect(page.locator("#situations, #translator, textarea")).toHaveCount(0);
  const html = await response!.text();
  expect(html).not.toContain("Возможно, Искра");
  expect(html).not.toContain("grani-pair-drafts-v1");
});

test("paid map works before the generated extra text is ready", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "preparing")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.locator("#situations [data-situation-card]")).toHaveCount(8);
  await page.getByText("Подробный текстовый разбор", { exact: true }).click();
  await expect(page.getByText("Готовим дополнительный текстовый разбор.", { exact: false })).toBeVisible();
});

test("outsiders cannot access a pair and signed-out visitors must sign in", async ({ page, context }) => {
  const pair = fixtures.pairs.find(p => p.state === "ready")!;
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page).toHaveURL(/\/login/);
  await context.addCookies([{ name: "grani_session", value: fixtures.unpaid.token, url: baseURL }]);
  expect((await page.goto(`/pair/${pair.pairId}`))?.status()).toBe(404);
});

test("checkout keeps 399 rubles, cancel keeps content locked, confirmed payment opens the map", async ({ browser }, testInfo) => {
  const pair = fixtures.pairs.find(p => p.state === "available")!;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, isMobile: false, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  await page.goto(`/pair/${pair.pairId}`);
  await page.getByRole("button", { name: /Открыть разбор пары за 399/ }).click();
  await page.getByLabel("Почта для чека", { exact: true }).fill("pair-map-qa@example.test");
  await page.getByRole("button", { name: "Перейти к оплате", exact: true }).click();
  await expect(page).toHaveURL(/\/dev\/pay\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("399 ₽");
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.locator("#situations")).toHaveCount(0);
  const output = process.env.PAIR_MAP_QA_OUTPUT;
  await page.screenshot({ path: output ? `${output}/pair-map-unpaid.png` : testInfo.outputPath("unpaid.png"), fullPage: true });
  await page.getByRole("button", { name: /Открыть разбор пары за 399/ }).click();
  await expect(page).toHaveURL(/\/dev\/pay\//);
  await page.getByRole("button", { name: "Оплатить", exact: true }).click();
  await expect(page).toHaveURL(/\/purchases\//);
  await page.getByRole("link", { name: "Открыть интерактивную карту пары", exact: true }).click();
  await expect(page.locator("#situations [data-situation-card]")).toHaveCount(8);
  await expect(page.locator(".pair-person [data-gem-dir][data-loaded=true]")).toHaveCount(2);
  await page.screenshot({ path: output ? `${output}/pair-map-desktop-hero.png` : testInfo.outputPath("desktop-hero.png"), fullPage: false });
  await context.close();
});

test("map has no visible overflow across desktop and mobile widths", async ({ page, context }, testInfo) => {
  const pair = fixtures.pairs.find(p => p.state === "ready")!;
  await context.addCookies([{ name: "grani_session", value: pair.members[0]!.token, url: baseURL }]);
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.locator(".pair-person [data-gem-dir][data-loaded=true]")).toHaveCount(2);
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#situations summary").first().click();
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll("main *")).filter(n => {
        if (!n.getClientRects().length) return false;
        const closed = n.closest("details:not([open])");
        if (closed && !closed.querySelector("summary")?.contains(n) && n !== closed) return false;
        const r = n.getBoundingClientRect(); let left=r.left, right=r.right;
        for (let parent=n.parentElement; parent; parent=parent.parentElement) {
          if (["auto","scroll","hidden","clip"].includes(getComputedStyle(parent).overflowX)) {
            const p=parent.getBoundingClientRect(); left=Math.max(left,p.left); right=Math.min(right,p.right);
          }
        }
        if (right <= left) return false;
        return left < -1 || right > innerWidth + 1;
      }).map(n => n.className) }));
    expect(geometry.width, JSON.stringify(geometry.overflow)).toBeLessThanOrEqual(width);
    expect(geometry.overflow).toEqual([]);
    const path = process.env.PAIR_MAP_QA_OUTPUT ? `${process.env.PAIR_MAP_QA_OUTPUT}/pair-map-${width}.png` : testInfo.outputPath(`pair-map-${width}.png`);
    await page.screenshot({ path, fullPage: true, scale: "css" });
    await page.locator("#situations summary").first().click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/pair/${pair.pairId}`);
  await expect(page.locator(".pair-person [data-gem-dir][data-loaded=true]")).toHaveCount(2);
  await page.screenshot({ path: process.env.PAIR_MAP_QA_OUTPUT ? `${process.env.PAIR_MAP_QA_OUTPUT}/pair-map-mobile-hero.png` : testInfo.outputPath("mobile-hero.png"), fullPage: false, scale: "css" });
  const firstCard = page.locator("#situations summary").first();
  await firstCard.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#situations details[open]")).toHaveCount(1);
  const partner = page.getByRole("button", { name: /Партнёра ·/ });
  await partner.focus();
  await page.keyboard.press("Space");
  await expect(partner).toHaveAttribute("aria-pressed", "true");
});
