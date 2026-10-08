import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../scripts/check-design-contrast.mjs";
import { seedReportNightFixtures } from "./report-night-fixtures";

test.skip(!process.env.RESULT_QA_DATABASE_URL || !process.env.RESULT_QA_SESSION_SECRET, "Explicit local authenticated report QA fixtures are required");
let fixtures: Awaited<ReturnType<typeof seedReportNightFixtures>>;
test.beforeAll(async () => { fixtures = await seedReportNightFixtures(); });
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function verifyNightPage(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main")).toHaveAttribute("data-band", "night");
  await expect(page.locator("main[data-night-entry]")).toHaveCount(1);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll("body *")).map(node => ({ name: node.className, text: node.textContent?.slice(0, 60), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, scroll: (node as HTMLElement).scrollWidth, client: (node as HTMLElement).clientWidth })).filter(node => node.right > innerWidth + 1 || node.left < -1 || node.scroll > node.client + 1),
  }));
  expect(geometry.width, JSON.stringify(geometry.overflowing)).toBeLessThanOrEqual(width);
  const chrome = await page.locator("main, .footer").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).getPropertyValue("--chrome-bg").trim()));
  expect(chrome[1]).toBe(chrome[0]);
  for (const node of await page.locator("main .card, .report-section, .report-portrait, .report-manual, .report-chapters, .share-card").all()) await expect(node).toHaveCSS("box-shadow", "none");
  const samples = await page.locator("main h1, main h2, main h3, main p, main li, main .tip, .compare__bar b, .compare__bar > span:first-child").evaluateAll(nodes => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const channels = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); };
    const background = (node: Element | null): number[] => {
      if (!node) return [255, 255, 255];
      const style = getComputedStyle(node), color = channels(style.backgroundColor);
      if (color[3] === 0 && style.backgroundImage.includes("linear-gradient")) {
        const stops = [...style.backgroundImage.matchAll(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g)].map(match => channels(match[0]));
        if (stops.length) return [0, 1, 2].map(i => Math.max(...stops.map(stop => Math.round(stop[i] * stop[3] / 255 + 255 * (1 - stop[3] / 255)))));
      }
      if (color[3] === 255) return color.slice(0, 3);
      const parent = background(node.parentElement), alpha = color[3] / 255;
      return parent.map((value, i) => Math.round(color[i] * alpha + value * (1 - alpha)));
    };
    const hex = (color: number[]) => "#" + color.slice(0, 3).map(value => value.toString(16).padStart(2, "0")).join("");
    return nodes.filter(node => (node as HTMLElement).checkVisibility() && node.textContent?.trim()).map(node => ({ text: node.textContent, fg: hex(channels(getComputedStyle(node).color)), bg: hex(background(node)) }));
  });
  for (const sample of samples) expect(contrastRatio(sample.fg, sample.bg), `${sample.text}: contrast`).toBeGreaterThanOrEqual(4.5);
}

for (const name of ["Искра", "Тихая хранительница"]) for (const width of [320, 390, 1024, 1440]) {
  test(`personal report ${name}, ${width}px`, async ({ page, context }, testInfo) => {
    const fixture = fixtures.reports.find(item => item.name === name && item.state === "ready")!;
    await context.addCookies([{ name: "grani_session", value: fixture.token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/report/${fixture.resultId}`);
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await expect(page.locator(".report-hero [data-gem-dir]")).toHaveAttribute("data-gem-dir", fixture.dir);
    await expect(page.locator(".report-hero [data-gem-dir]")).toHaveAttribute("data-loaded", "true");
    expect(await page.locator("main h2").allTextContents()).toEqual(["Портрет", "Сильные стороны", "Слепые зоны", "Как со мной", "Карточка «инструкция по применению меня»", "Взгляд друзей", "Разные грани твоей жизни"]);
    await expect(page.locator(".report-section__number")).toHaveText(["01", "02", "03"]);
    const card = await page.request.get(`/cards/manual/${fixture.resultId}`);
    expect(card.status()).toBe(200);
    expect(card.headers()["cache-control"]).toBe("private, no-store");
    expect(card.headers()["content-type"]).toContain("image/png");
    const bytes = await card.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1920]);
    expect(bytes.length).toBeLessThan(1_000_000);
    if (width === 320) {
      const backgrounds = await page.evaluate(async (src) => {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
        const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
        const colors: string[] = [];
        for (const x of [32, 1048]) for (let y = 32; y < 1920; y += 32) {
          colors.push("#" + Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3).map(value => value.toString(16).padStart(2, "0")).join(""));
        }
        return colors;
      }, `data:image/png;base64,${bytes.toString("base64")}`);
      for (const background of backgrounds) {
        expect(contrastRatio("#EFE9DA", background), "manual background dimming").toBeGreaterThanOrEqual(7);
        expect(contrastRatio("#A3B0A2", background), "manual muted text").toBeGreaterThanOrEqual(4.5);
      }
    }
    if (process.env.REPORT_QA_OUTPUT_DIR) { await mkdir(process.env.REPORT_QA_OUTPUT_DIR, { recursive: true }); await writeFile(join(process.env.REPORT_QA_OUTPUT_DIR, `manual-${fixture.dir}.png`), bytes); }
    await verifyNightPage(page, width);
    const prefix = process.env.REPORT_QA_OUTPUT_DIR ? join(process.env.REPORT_QA_OUTPUT_DIR, `report-${fixture.dir}-${width}`) : testInfo.outputPath(`report-${fixture.dir}-${width}`);
    await page.screenshot({ path: `${prefix}-viewport.png`, scale: "css" });
    await page.screenshot({ path: `${prefix}.png`, fullPage: true, scale: "css" });
    expect(errors).toEqual([]);
  });
}

for (const viewer of [0, 1]) for (const width of [320, 390, 1024, 1440]) {
  test(`ready pair viewer ${viewer}, ${width}px`, async ({ page, context }, testInfo) => {
    const fixture = fixtures.pairs.find(item => item.state === "ready")!;
    await context.addCookies([{ name: "grani_session", value: fixture.members[viewer].token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/pair/${fixture.pairId}`);
    await expect(page.getByRole("heading", { name: "Как вам быть вместе", exact: true })).toBeVisible();
    await expect(page.locator(".pair-person [data-gem-dir]")).toHaveCount(2);
    for (const gem of await page.locator(".pair-person [data-gem-dir]").all()) await expect(gem).toHaveAttribute("data-loaded", "true");
    await expect(page.locator("main")).toHaveAttribute("data-palette", "pair");
    const gold = await page.locator("main").evaluate(node => getComputedStyle(node).getPropertyValue("--gold").trim());
    expect(gold.toLowerCase()).toBe("#e3b3a0");
    await expect(page.locator(".pair-score")).toHaveCSS("color", "rgb(227, 179, 160)");
    await expect(page.locator(".report > .stack")).toHaveCount(5);
    await verifyNightPage(page, width);
    const prefix = process.env.REPORT_QA_OUTPUT_DIR ? join(process.env.REPORT_QA_OUTPUT_DIR, `pair-viewer-${viewer}-${width}`) : testInfo.outputPath(`pair-viewer-${viewer}-${width}`);
    await page.screenshot({ path: `${prefix}-viewport.png`, scale: "css" });
    await page.screenshot({ path: `${prefix}.png`, fullPage: true, scale: "css" });
    expect(errors).toEqual([]);
  });
}

for (const state of ["available", "preparing"] as const) for (const width of [320, 390]) {
  test(`pair ${state}, ${width}px`, async ({ page, context }, testInfo) => {
    const fixture = fixtures.pairs.find(item => item.state === state)!;
    await context.addCookies([{ name: "grani_session", value: fixture.members[1].token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/pair/${fixture.pairId}`);
    if (state === "available") await expect(page.getByRole("button", { name: "Открыть разбор пары за 399 ₽", exact: true })).toBeVisible();
    else await expect(page.getByText("Готовим разбор пары… Страница обновится сама.")).toBeVisible();
    await verifyNightPage(page, width);
    await page.screenshot({ path: process.env.REPORT_QA_OUTPUT_DIR ? join(process.env.REPORT_QA_OUTPUT_DIR, `pair-${state}-${width}.png`) : testInfo.outputPath(`pair-${state}-${width}.png`), fullPage: true, scale: "css" });
  });
}

test("personal report preparing and private manual access", async ({ page, context, browser }) => {
  const fixture = fixtures.reports.find(item => item.state === "preparing")!;
  await context.addCookies([{ name: "grani_session", value: fixture.token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/report/${fixture.resultId}`);
  await expect(page.getByText("Готовим разбор… Страница обновится сама.")).toBeVisible();
  await verifyNightPage(page, 320);
  const other = fixtures.reports.find(item => item.state === "ready")!;
  expect((await page.request.get(`/cards/manual/${other.resultId}`)).status()).toBe(404);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(`${baseURL}/cards/manual/${other.resultId}`)).status()).toBe(401);
  await anonymous.close();
});

test("unpaid personal report still redirects to the result", async ({ page, context }) => {
  await context.addCookies([{ name: "grani_session", value: fixtures.unpaid.token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/report/${fixtures.unpaid.resultId}`);
  await expect(page).toHaveURL(`${baseURL}/result/${fixtures.unpaid.resultId}`);
});
