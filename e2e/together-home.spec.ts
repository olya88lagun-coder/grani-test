import { chromium, expect, type Browser } from "@playwright/test";
import { test } from "./together-fixture";
import { BASE_URL, openCurrentQuestion, uniqueName } from "./helpers";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map((channel) => {
      const value = Number(channel) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

async function activePair(browser: Browser) {
  const firstContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ru-RU" });
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  const names = [[first, "Анна", uniqueName("Анна")], [second, "Марк", uniqueName("Марк")]] as const;
  for (const [page, , loginName] of names) {
    await page.goto(`/api/dev/login?name=${encodeURIComponent(loginName)}`);
    await page.evaluate(() => localStorage.setItem("grani-cookie-consent", "necessary"));
  }
  if (process.env.P1_CAPTURE === "1") {
    // Только имена синтетических аккаунтов в отдельной локальной БД; скриншоты не содержат случайные ID.
    const address = process.env.E2E_DATABASE_URL;
    if (!address) throw new Error("Screenshot capture needs the isolated E2E database");
    const url = new URL(address);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/postgres") throw new Error("Screenshot names may only change in localhost:5442/postgres");
    const require = createRequire(resolve("packages/db/package.json"));
    const sql = require("postgres")(address, { max: 1, prepare: false });
    try {
      for (const [, name, loginName] of names) await sql`update auth_identities set display_name = ${name} where provider = 'vk' and external_id = ${`dev-${loginName}`}`;
    } finally { await sql.end(); }
  }
  const headers = { origin: BASE_URL };
  const createdResponse = await first.request.post("/api/together/spaces", { data: { consent: true }, headers });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json();
  expect((await second.request.post("/api/together/invite/request", { data: { token: created.inviteUrl.split("/").at(-1), consent: true }, headers })).ok()).toBe(true);
  expect((await first.request.post("/api/together/invite/confirm", { data: { accept: true }, headers })).ok()).toBe(true);
  return { first, second, close: async () => { await firstContext.close(); await secondContext.close(); } };
}

test("R3 answer disclosure returns focus, preserves draft and groups secondary actions", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    await pair.first.goto("/together");
    const disclosure = pair.first.locator(".tc-answer > summary");
    await expect(disclosure).toHaveText("Ответить");
    await disclosure.focus();
    await pair.first.keyboard.press("Enter");
    const question = pair.first.getByLabel(/Какой небольшой поступок/);
    await expect(question).toBeFocused();
    await expect(disclosure).toHaveText("Свернуть ответ");
    await question.fill("Несохранённый черновик R3");
    await disclosure.focus();
    await pair.first.keyboard.press("Enter");
    await expect(question).toBeHidden();
    await expect(disclosure).toBeFocused();
    await expect(disclosure).toHaveText("Ответить");
    await pair.first.keyboard.press("Enter");
    await expect(question).toHaveValue("Несохранённый черновик R3");
    await expect(pair.first.getByRole("button", { name: "Выйти из пространства", exact: true })).toBeHidden();
    const settings = pair.first.locator("details[data-space-settings] > summary");
    await settings.focus();
    await pair.first.keyboard.press("Enter");
    await expect(pair.first.getByRole("button", { name: "Выйти из пространства", exact: true })).toBeVisible();
    await expect(pair.first.getByRole("navigation", { name: "Документы и разделы" })).toBeVisible();
    await settings.focus();
    await pair.first.keyboard.press("Enter");
    await expect(pair.first.getByRole("button", { name: "Выйти из пространства", exact: true })).toBeHidden();
    await expect(pair.first.getByRole("navigation", { name: "Документы и разделы" })).toBeHidden();
    expect((await (await pair.first.request.get("/api/together/cards/current")).json()).card.mine).toBeNull();
  } finally { await pair.close(); }
});

test("active home: one activity, real greeting, honest moments, five widths and keyboard", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    await pair.first.goto("/together");
    await expect(pair.first.getByRole("heading", { level: 1 })).toHaveText("Анна и Марк, приятно видеть вас!");
    await expect(pair.first.getByText("Знакомство с пространством", { exact: true })).toBeVisible();
    await expect(pair.first.getByText("Три вводные карточки бесплатно")).toBeVisible();
    await expect(pair.first.getByRole("progressbar")).toHaveCount(0);
    await expect(pair.first.getByRole("heading", { name: "Пока здесь тихо" })).toBeVisible();
    await expect(pair.first.getByRole("heading", { name: "Наши разговоры" })).toBeVisible();
    await expect(pair.first.getByText(/Функция сохранения появится позже/)).toBeVisible();
    await expect(pair.first.getByText(/Книга вашей истории/)).toBeVisible();
    const activity = pair.first.getByLabel("Текущая карточка", { exact: true });
    await expect(activity.locator("textarea")).toBeHidden();
    await pair.first.locator('picture img').evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
    await expect(activity.locator('picture')).toHaveAttribute('aria-hidden', 'true');
    if (process.env.P1_CAPTURE === "1") await pair.first.screenshot({ path: resolve("../../outputs/together-p1-r3/desktop-1440.png"), fullPage: true, scale: "css", style: "nextjs-portal { visibility: hidden; }" });
    await openCurrentQuestion(pair.first);
    await expect(activity.getByRole("button", { name: "Отправить ответ" })).toHaveCount(1);
    const bg = await activity.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(bg).toBe("rgb(239, 233, 218)");
    const textColors = await activity.evaluate((node) => [...node.querySelectorAll(".eyebrow, .muted, .lead, label")].map((text) => getComputedStyle(text).color));
    for (const color of textColors) expect(contrast(color, bg)).toBeGreaterThanOrEqual(4.5);
    const submit = activity.getByRole("button", { name: "Отправить ответ" });
    for (const hovered of [false, true]) {
      if (hovered) await submit.hover();
      const colors = await submit.evaluate((node) => ({ text: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
      expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
    }
    if (process.env.P1_CAPTURE === "1") await pair.first.screenshot({ path: resolve("../../outputs/together-p1-r3/desktop-form-1440.png"), fullPage: true, scale: "css", style: "nextjs-portal { visibility: hidden; }" });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await pair.first.setViewportSize({ width, height: 1000 });
      expect(await pair.first.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const teaser = await pair.first.getByText(/Книга вашей истории/).evaluate((text) => {
        const panel = text.closest("section")!.getBoundingClientRect();
        const copy = text.getBoundingClientRect();
        const book = text.parentElement!.querySelector("picture")!.getBoundingClientRect();
        return { panelRight: panel.right, panelLeft: panel.left, textRight: copy.right, textLeft: copy.left, bookRight: book.right, bookLeft: book.left };
      });
      expect(teaser.textRight, `book caption clipped at ${width}px`).toBeLessThanOrEqual(teaser.panelRight - 8);
      expect(teaser.bookRight, `book clipped at ${width}px`).toBeLessThanOrEqual(teaser.panelRight - 8);
      expect(Math.min(teaser.textLeft, teaser.bookLeft)).toBeGreaterThanOrEqual(teaser.panelLeft + 8);
      const decoration = activity.locator("picture img");
      expect(await decoration.evaluate((image) => (image as HTMLImageElement).currentSrc)).toContain(width < 760 ? "360.webp" : "720.webp");
      await expect(activity.getByRole("button", { name: "Отправить ответ" })).toBeVisible();
      await expect(pair.first.getByRole("heading", { level: 1 })).toHaveCount(1);
      if (width === 390 && process.env.P1_CAPTURE === "1") {
        await pair.first.screenshot({ path: resolve("../../outputs/together-p1-r3/mobile-form-390.png"), fullPage: true, scale: "css", style: "nextjs-portal { visibility: hidden; }" });
        await pair.first.locator(".tc-answer > summary").click();
        await pair.first.screenshot({ path: resolve("../../outputs/together-p1-r3/mobile-390.png"), fullPage: true, scale: "css", style: "nextjs-portal { visibility: hidden; }" });
        await openCurrentQuestion(pair.first);
      }
    }
    await pair.first.emulateMedia({ reducedMotion: "reduce" });
    await pair.first.getByRole("button", { name: "Пропустить карточку" }).focus();
    await pair.first.keyboard.press("Enter");
    await expect(pair.first.getByRole("dialog", { name: "Пропустить для обоих?" })).toBeVisible();
    await pair.first.keyboard.press("Escape");
    await expect(pair.first.getByRole("button", { name: "Пропустить карточку" })).toBeFocused();
    await pair.first.getByRole("button", { name: "История карточек" }).click();
    await expect(pair.first.getByText("История ещё впереди. Здесь появятся раскрытые и пропущенные карточки.")).toBeVisible();
  } finally { await pair.close(); }
});

test("revoked CareCard consent clears old entries even if current-card refresh fails", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    const original = await (await pair.first.request.get("/api/together/cards/current")).json();
    let revoked = false;
    const care = { title: "Наши способы заботы", members: [{ id: "a", name: "Анна", attention: [{ text: "Отозванный пункт", context: null }], ease: [] }, { id: "b", name: "Марк", attention: [], ease: [] }], rituals: [], complete: false, empty: false };
    const card = { ...original.card, state: "revealed", fields: [{ id: "answer", type: "short_text", label: "Ответ", required: true }, { id: "allow_care_reward", type: "boolean", label: "Предлагаю этот пункт для итоговой карточки", required: false, availableAt: "after_reveal" }], mine: { fields: { answer: "Ответ", allow_care_reward: true }, revision: 1, done: false }, partner: { status: "answered", fields: { answer: "Ответ партнёра" } } };
    await pair.first.route("**/api/together/cards/current", (route) => route.fulfill({ status: revoked ? 503 : 200, json: revoked ? { ok: false } : { ...original, card } }));
    await pair.first.route("**/api/together/care", (route) => route.fulfill({ json: { ok: true, ready: true, card: revoked ? { ...care, empty: true, members: care.members.map((member) => ({ ...member, attention: [] })) } : care } }));
    await pair.first.route(`**/api/together/cards/${card.id}/answer`, async (route) => {
      expect(route.request().postDataJSON().fields.allow_care_reward).toBe(false);
      revoked = true;
      await route.fulfill({ json: { ok: true } });
    });
    await pair.first.goto("/together");
    await expect(pair.first.getByText("Отозванный пункт")).toBeVisible();
    await pair.first.getByLabel("Предлагаю этот пункт для итоговой карточки", { exact: true }).click();
    await expect(pair.first.getByLabel("Текущая карточка", { exact: true }).getByRole("alert")).toContainText("Не получилось связаться с сервером");
    await expect(pair.first.getByText("Отозванный пункт")).toHaveCount(0);
    await expect(pair.first.getByText("Пока без выбранных пунктов")).toBeVisible();
  } finally { await pair.close(); }
});

test("CareCard: request failure is visible and retry restores data; consent reload removes old content", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    let phase: "failure" | "ready" | "removed" = "failure";
    const care = { title: "Наши способы заботы", members: [{ id: "a", name: "Анна", attention: [{ text: "Мой выбранный пункт", context: null }], ease: [] }, { id: "b", name: "Марк", attention: [], ease: [] }], rituals: [], complete: false, empty: false };
    await pair.first.route("**/api/together/care", (route) => route.fulfill({ status: phase === "failure" ? 503 : 200, json: phase === "failure" ? { ok: false, error: "unavailable" } : { ok: true, ready: true, card: phase === "removed" ? { ...care, empty: true, members: care.members.map((member) => ({ ...member, attention: [] })) } : care } }));
    // Проверяем ручной retry после начального чтения: начальный current сам тоже обновляет CareCard.
    await pair.first.goto("/together", { waitUntil: "networkidle" });
    await expect(pair.first.getByRole("heading", { name: "Замечать хорошее" })).toBeVisible();
    await expect(pair.first.getByText("Не получилось загрузить карточку заботы.")).toBeVisible();
    phase = "ready";
    await pair.first.getByRole("button", { name: "Повторить загрузку карточки заботы" }).click();
    await expect(pair.first.getByText("Мой выбранный пункт")).toBeVisible();
    // Ответ на текущую карточку вызывает актуальное чтение CareCard в этой же вкладке.
    phase = "removed";
    await openCurrentQuestion(pair.first);
    await pair.first.getByLabel(/Какой небольшой поступок/).fill("Ответ Анны");
    await pair.first.getByRole("button", { name: "Отправить ответ" }).click();
    await expect(pair.first.getByText("Пока без выбранных пунктов")).toBeVisible();
    await expect(pair.first.getByText("Мой выбранный пункт")).toHaveCount(0);
  } finally { await pair.close(); }
});

test("current error keeps home and offers retry instead of pretending route is complete", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    let broken = true;
    await pair.first.route("**/api/together/cards/current", async (route) => broken ? route.fulfill({ status: 503, json: { ok: false } }) : route.continue());
    await pair.first.goto("/together");
    await expect(pair.first.getByRole("heading", { level: 1 })).toHaveText("Анна и Марк, приятно видеть вас!");
    await expect(pair.first.getByLabel("Текущая карточка", { exact: true }).getByRole("alert")).toContainText("Не получилось связаться с сервером");
    await expect(pair.first.getByText("Вы прошли этот маршрут")).toHaveCount(0);
    broken = false;
    await pair.first.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(pair.first.getByRole("heading", { name: "Замечать хорошее" })).toBeVisible();
  } finally { await pair.close(); }
});

test("history and friend link stay open when the initial activity finishes loading", async ({ browser }) => {
  const pair = await activePair(browser);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  try {
    const snapshot = await (await pair.first.request.get("/api/together/cards/current")).json();
    await pair.first.route("**/api/together/cards/current", async (route) => { await gate; await route.fulfill({ json: snapshot }); });
    await pair.first.goto("/together");
    await expect(pair.first.getByText("Загружаем карточку…")).toBeVisible();
    await pair.first.getByRole("button", { name: "История карточек" }).click();
    await expect(pair.first.getByRole("button", { name: "Скрыть историю" })).toHaveAttribute("aria-expanded", "true");
    await pair.first.locator("details[data-space-settings] > summary").click();
    await pair.first.getByText("Поделиться с парой друзей", { exact: true }).click();
    await pair.first.getByRole("button", { name: "Получить ссылку", exact: true }).click();
    await expect(pair.first.getByLabel("Ссылка для друзей", { exact: true })).toBeVisible();
    release();
    await expect(pair.first.getByRole("heading", { name: "Замечать хорошее" })).toBeVisible();
    await expect(pair.first.getByRole("button", { name: "Скрыть историю" })).toHaveAttribute("aria-expanded", "true");
    await expect(pair.first.getByLabel("Ссылка для друзей", { exact: true })).toBeVisible();
  } finally { release(); await pair.close(); }
});

test("background CareCard refresh keeps unchanged consented entries visible while the response waits", async ({ browser }) => {
  const pair = await activePair(browser);
  let hold = false;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const pending = new Promise<void>((resolve) => { started = resolve; });
  try {
    const original = await (await pair.first.request.get("/api/together/cards/current")).json();
    await pair.first.request.put(`/api/together/cards/${original.card.id}/answer`, { data: { fields: { answer: "Ответ Анны" } }, headers: { origin: BASE_URL } });
    const care = { title: "Наши способы заботы", members: [{ id: "a", name: "Анна", attention: [{ text: "Неизменный выбранный пункт", context: null }], ease: [] }, { id: "b", name: "Марк", attention: [], ease: [] }], rituals: [], complete: false, empty: false };
    await pair.first.route("**/api/together/care", async (route) => {
      if (hold) { started(); await gate; }
      await route.fulfill({ json: { ok: true, ready: true, card: care } });
    });
    await pair.first.goto("/together", { waitUntil: "networkidle" });
    await expect(pair.first.getByText("Неизменный выбранный пункт")).toBeVisible();
    hold = true;
    await pair.first.getByRole("button", { name: "Проверить ответы" }).click();
    await pending;
    await expect(pair.first.getByText("Неизменный выбранный пункт")).toBeVisible({ timeout: 1000 });
    await expect(pair.first.getByText("Обновляем карточку заботы…")).toHaveCount(0);
    release();
    await expect(pair.first.getByText("Неизменный выбранный пункт")).toBeVisible();
  } finally { release(); await pair.close(); }
});

test("compact question opens from the keyboard and keeps the unsent draft after closing", async ({ browser }) => {
  const pair = await activePair(browser);
  try {
    await pair.first.goto("/together");
    const question = pair.first.getByLabel(/Какой небольшой поступок/);
    await expect(question).toBeHidden();
    const open = pair.first.locator(".tc-answer > summary");
    await open.focus();
    await pair.first.keyboard.press("Enter");
    await expect(question).toBeVisible();
    await expect(question).toBeFocused();
    await question.fill("Черновик, который нельзя потерять");
    await open.click();
    await expect(question).toBeHidden();
    await open.click();
    await expect(question).toHaveValue("Черновик, который нельзя потерять");
    const current = await (await pair.first.request.get("/api/together/cards/current")).json();
    expect(current.card.mine).toBeNull();
  } finally { await pair.close(); }
});

test("real Chrome 200-percent zoom, cookie banner and keyboard keep the active home usable", async ({ browser }) => {
  const pair = await activePair(browser);
  const context = await chromium.launchPersistentContext("", { channel: "chrome", headless: true, viewport: null, deviceScaleFactor: undefined, isMobile: false, hasTouch: false, args: ["--window-size=1440,1000"] });
  try {
    await context.addCookies(await pair.first.context().cookies());
    const settings = await context.newPage();
    await settings.goto("chrome://settings");
    await settings.evaluate(() => (globalThis as unknown as { chrome: { settingsPrivate: { setDefaultZoom: (factor: number) => Promise<void> } } }).chrome.settingsPrivate.setDefaultZoom(2));
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/together`);
    await expect(page.getByRole("link", { name: "Мой профиль", exact: true })).toBeVisible();
    await page.addStyleTag({ content: "nextjs-portal { visibility: hidden; }" });
    const captureZoom = async (name: string) => {
      // Прямой снимок viewport Chrome: fullPage Playwright неверно обрезает ширину при настоящем browser zoom.
      const session = await context.newCDPSession(page);
      const shot = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      await writeFile(resolve(`../../outputs/together-p1-r3/${name}.png`), Buffer.from(shot.data, "base64"));
      await session.detach();
    };
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анна и Марк, приятно видеть вас!");
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    expect(await page.evaluate(() => innerWidth)).toBeLessThan(740);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const banner = page.getByRole("dialog", { name: "Cookie", exact: true });
    await expect(banner).toBeVisible();
    if (process.env.P1_CAPTURE === "1") await captureZoom("zoom-200-cookie");
    await banner.getByRole("button", { name: "Только необходимые" }).focus();
    await page.keyboard.press("Enter");
    await expect(banner).toHaveCount(0);
    await page.locator(".tc-answer > summary").focus();
    await page.keyboard.press("Enter");
    const question = page.getByLabel(/Какой небольшой поступок/);
    await expect(question).toBeFocused();
    await question.fill("Черновик при настоящем масштабе браузера 200%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.P1_CAPTURE === "1") await captureZoom("zoom-200-form");
  } finally { await context.close(); await pair.close(); }
});
