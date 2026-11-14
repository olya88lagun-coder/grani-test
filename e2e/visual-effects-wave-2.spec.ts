import { expect, type Page } from "@playwright/test";
import { test } from "./together-fixture";
import { uniqueName } from "./helpers";
import { seedResultNightFixtures } from "./result-night-fixtures";

const mobile = { width: 375, height: 812 };
const desktop = { width: 1440, height: 900 };
const output = process.env.WAVE_TWO_QA_OUTPUT;

async function capture(page: Page, name: string) {
  if (output) await page.screenshot({ path: `${output}/${name}.png`, scale: "css" });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const viewport of [mobile, desktop]) {
  test.describe(`second queue at ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: viewport === mobile, hasTouch: viewport === mobile });

    test("partner guess fills a stone and keeps the invitation route", async ({ page }) => {
      await page.goto("/compatibility");
      const guess = page.getByRole("region", { name: "Угадай партнёра" });
      await guess.scrollIntoViewIfNeeded();
      const pair = guess.locator("[data-pair-facets]");
      await expect(pair).toHaveAttribute("data-joined", "false");
      await expect(guess.getByRole("heading", { name: "Угадай партнёра" })).toHaveCSS("color", "rgb(239, 233, 218)");
      await page.evaluate(() => document.fonts.ready);
      const before = await guess.evaluate(el => el.offsetHeight);
      await capture(page, `guess-${viewport.width}-before`);
      await guess.getByRole("radio", { name: "Точно про меня" }).check();
      await expect(pair).toHaveAttribute("data-joined", "true");
      await expect(guess.getByRole("status")).toHaveText("Прогноз выбран.");
      const invite = guess.getByRole("button", { name: "Позвать партнёра" });
      await expect(invite).toBeEnabled();
      expect(await guess.evaluate(el => el.offsetHeight)).toBe(before);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await capture(page, `guess-${viewport.width}`);
      // Прогноз ложится в браузер при переходе к приглашению и не уходит в адрес
      expect(await page.evaluate(() => localStorage.getItem("grani:partner-guess:v1"))).toBeNull();
      await invite.click();
      await expect(page).not.toHaveURL(/\/compatibility/);
      expect(page.url()).not.toContain("value");
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("grani:partner-guess:v1") ?? "null"));
      expect(kept).toMatchObject({ value: 5 });
    });
  });
}

test("Together demo reveals the sample answer after both steps", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/together");
  const card = page.locator("[data-card-demo]");
  const turn = card.getByRole("button", { name: "Перевернуть карточку" });
  await turn.scrollIntoViewIfNeeded();
  const before = await card.evaluate(el => el.offsetHeight);
  await turn.click();
  await expect(card).toHaveAttribute("data-card-demo", "waiting");
  const hidden = card.locator("[data-revealed]");
  await expect(hidden).toHaveAttribute("aria-hidden", "true");
  await expect(hidden).toHaveCSS("animation-name", "none");
  const answer = card.getByRole("button", { name: "Ответить в примере" });
  await expect(answer).toBeFocused();
  await answer.click();
  await expect(card.getByRole("status")).toHaveText("Оба ответа открыты.");
  await expect(hidden).toHaveAttribute("aria-hidden", "false");
  expect(await card.evaluate(el => el.offsetHeight)).toBe(before);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await capture(page, "together-card-375");
  await card.getByRole("button", { name: "Показать заново" }).click();
  await expect(turn).toBeFocused();
});

test("waiting stone joins after the real partner confirmation", async ({ page, browser }) => {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const headers = { origin: baseURL };
  await page.setViewportSize(mobile);
  await page.goto("/together");
  await page.getByRole("link", { name: "Создать пространство для двоих" }).click();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Аня"))}`);
  await expect(page).toHaveURL(/\/together\/start$/);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Создать и получить приглашение" }).click();
  const stones = page.locator("[data-pair-facets]");
  await expect(stones).toHaveAttribute("data-waiting", "true");
  await expect(stones.locator("svg").last()).toHaveCSS("animation-name", "breathe");
  const link = page.getByRole("textbox", { name: "Личная ссылка" });
  await expect(link).toBeVisible();
  await capture(page, "together-waiting-375");
  const invite = await link.inputValue();
  const partner = await browser.newContext({ baseURL });
  try {
    const second = await partner.newPage();
    await second.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Борис"))}`);
    const token = new URL(invite).pathname.split("/").at(-1);
    const requested = await second.request.post("/api/together/invite/request", { headers, data: { token, consent: true } });
    expect(requested.ok()).toBe(true);
    await page.goto("/together");
    await expect(page.getByRole("heading", { name: "Это ваш человек?" })).toBeVisible();
    await expect(stones).toHaveAttribute("data-joined", "false");
    await page.getByRole("button", { name: "Да, подтвердить партнёра" }).click();
    await expect(stones).toHaveAttribute("data-confirmed", "true");
    await expect(stones.locator("[data-pair-thread]")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await capture(page, "together-confirmed-375");
  } finally {
    await partner.close();
  }
});

test("result facets change selection and anonymous friends have empty slots", async ({ page, context }) => {
  test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local QA configuration required");
  const fixture = (await seedResultNightFixtures())[0]!;
  const url = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  await context.addCookies([{ name: "grani_session", value: fixture.token, url }]);
  await page.setViewportSize(mobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/result/${fixture.resultId}`);
  const facets = page.locator("[data-my-facets]");
  const buttons = facets.getByRole("button");
  await expect(buttons).toHaveCount(5);
  await buttons.nth(2).click();
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(facets.getByRole("status")).toContainText("из 100");
  await expect(facets.locator("polygon[data-current='true']")).toHaveCount(1);
  await capture(page, "my-facets-375");
  const friends = page.locator("[data-friends-stones]");
  await expect(friends.locator("[data-answered='false']")).toHaveCount(3);
  await friends.scrollIntoViewIfNeeded();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await capture(page, "friends-empty-375");
});
