import { expect, test, type Page } from "@playwright/test";
import { seedResultNightFixtures } from "./result-night-fixtures";
import { SELF_ITEMS } from "../packages/content/src/items";

const mobile = { width: 375, height: 812 };
const desktop = { width: 1440, height: 900 };
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const output = process.env.VISUAL_EFFECTS_QA_OUTPUT;

async function screenshot(page: Page, name: string) {
  if (output) await page.screenshot({ path: `${output}/${name}.png`, scale: "css" });
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

for (const viewport of [mobile, desktop]) {
  test.describe(`visual effects at ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: viewport === mobile, hasTouch: viewport === mobile, deviceScaleFactor: 1 });

    test("the first answer colors one facet without moving the layout and carries over on continue", async ({ page }) => {
      await page.goto("/");
      const trial = page.getByRole("region", { name: "Открой первую грань" });
      await expectNoOverflow(page);
      await trial.scrollIntoViewIfNeeded();
      const first = trial.getByRole("radio", { name: "Точно про меня" });
      await expect(first).toBeEnabled();
      await page.evaluate(() => document.fonts.ready.then(() => true));
      const before = await trial.evaluate(el => el.offsetHeight);
      await screenshot(page, `mini-trial-${viewport.width}-before`);
      await first.check();
      await expect(trial.locator("[data-lit=true]")).toHaveCount(1);
      await expect(trial.getByRole("status")).toHaveText("Первая грань открыта.");
      await expect(trial.locator("[data-lit=true]")).toHaveCSS("opacity", "1");
      await screenshot(page, `mini-trial-${viewport.width}-after`);
      expect(await trial.evaluate(el => el.offsetHeight)).toBe(before);
      // Выбор живёт в состоянии компонента: черновик появляется только при переходе в тест
      expect(await page.evaluate(() => localStorage.getItem("grani:answers:v1"))).toBeNull();
      await trial.getByRole("button", { name: "Продолжить тест" }).click();
      await expect(page).toHaveURL(/\/test$/);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("grani:answers:v1") ?? "{}"))).toEqual({ [SELF_ITEMS[0]!.id]: 5 });
      await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
      await expectNoOverflow(page);
    });
  });
}

test("last five answers show a masked teaser and update the restored crystal", async ({ page }) => {
  await page.setViewportSize(mobile);
  const saved = Object.fromEntries(SELF_ITEMS.slice(0, 45).map(item => [item.id, 4]));
  await page.goto("/test");
  await page.evaluate(answers => localStorage.setItem("grani:answers:v1", JSON.stringify(answers)), saved);
  await page.reload();
  const progress = page.getByRole("progressbar");
  const teaser = page.locator("[data-test-teaser]");
  await expect(progress).toHaveAttribute("aria-valuenow", "45");
  await expect(progress.locator("[data-lit=true]")).toHaveCount(17);
  await expect(page.getByText("Результат через 5 ответов")).toBeVisible();
  await screenshot(page, "test-crystal-375");
  const initial = await teaser.evaluate(el => el.getBoundingClientRect().height);
  const last = await page.getByRole("radio", { name: "Точно про меня" }).all();
  await last[0]!.check();
  await last[1]!.check();
  await expect(teaser).toContainText("Результат через 3 ответа");
  expect(await teaser.evaluate(el => el.getBoundingClientRect().height)).toBe(initial);
  await expectNoOverflow(page);
});

test("the hero follows the desktop pointer and reveals five facets in view", async ({ browser }) => {
  const page = await browser.newPage({ baseURL, viewport: desktop, isMobile: false, hasTouch: false });
  try {
    await page.goto("/");
    const hero = page.locator("[data-hero-crystal]");
    await expect(hero).toHaveAttribute("data-crystal-reveal", "shown");
    await expect(hero.locator("svg polygon[style]")).toHaveCount(5);
    await expect(hero.locator(".home-crystal__label--extra")).toHaveCSS("animation-name", "fade-rise");
    const offsetX = () => hero.evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--mx")));
    await page.mouse.move(250, 300);
    await expect.poll(offsetX).toBeLessThan(-.2);
    await page.mouse.move(1200, 400);
    await expect.poll(offsetX).toBeGreaterThan(.2);
    await expectNoOverflow(page);
  } finally {
    await page.close();
  }
});

test("the hero shifts a little when scrolled on a phone", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto("/");
  const hero = page.locator("[data-hero-crystal]");
  await hero.scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute("data-crystal-in-view", "");
  const offset = () => hero.evaluate(el => (el as HTMLElement).style.getPropertyValue("--my"));
  await expect.poll(offset).not.toBe("");
  const before = await offset();
  await page.evaluate(() => window.scrollBy(0, 90));
  await expect.poll(offset).not.toBe(before);
  await expectNoOverflow(page);
});

test("reduced motion keeps the hero static and the mini trial usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.locator("[data-hero-crystal]");
  const label = hero.locator(".home-crystal__label--extra");
  await expect(label).toBeVisible();
  await expect(label).toHaveCSS("animation-name", "none");
  await expect(hero).not.toHaveAttribute("data-crystal-reveal", "shown");
  await page.getByRole("region", { name: "Открой первую грань" }).getByRole("radio", { name: "Отчасти" }).check();
  await expect(page.locator("[data-lit=true]")).toHaveCount(1);
});

test.describe("result reveal", () => {
  test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local QA configuration required");
  let fixture: Awaited<ReturnType<typeof seedResultNightFixtures>>[number];
  test.beforeAll(async () => { fixture = (await seedResultNightFixtures())[0]!; });
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "grani_session", value: fixture.token, url: baseURL }]);
  });

  test("can skip the reveal and focus the result heading", async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto(`/result/${fixture.resultId}`, { waitUntil: "commit" });
    const dialog = page.getByRole("dialog", { name: "Твой результат" });
    await expect(dialog).toBeVisible();
    await expectNoOverflow(page);
    const skip = dialog.getByRole("button", { name: "Пропустить анимацию" });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveCSS("background-color", "rgb(10, 31, 23)");
    await expect(dialog.getByText(fixture.name)).toHaveCSS("animation-name", "fade-rise");
    expect(await dialog.evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation instanceof CSSAnimation && animation.animationName === "fade-in"))).toBe(true);
    if (output) {
      await expect(dialog.getByText(fixture.name)).toHaveCSS("opacity", "1");
      await screenshot(page, "result-reveal-375");
    }
    await skip.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expectNoOverflow(page);
  });

  test("Escape and the timer both open the result and restore focus", async ({ page }) => {
    await page.goto(`/result/${fixture.resultId}`, { waitUntil: "commit" });
    const dialog = page.getByRole("dialog", { name: "Твой результат" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.reload({ waitUntil: "commit" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeHidden({ timeout: 4000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test("immediately shows the result with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/result/${fixture.resultId}`);
    await expect(page.getByRole("heading", { level: 1, name: fixture.name })).toBeVisible();
    await expect(page.locator("[data-result-reveal][open]")).toHaveCount(0);
  });
});
