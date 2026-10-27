import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve("test-results/new-year-evidence");
const open = async (page: Page) => { await page.goto("/new-year-2027"); await page.getByRole("button", { name: "Собрать мою карту" }).click(); };
const skip = async (page: Page, count = 6) => { for (let i = 0; i < count; i++) await page.getByRole("button", { name: "Пропустить этот вопрос" }).click(); };
test.beforeAll(async () => { await mkdir(evidence, { recursive: true }); });

test("guest can skip everything, edit and clear the local draft", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await skip(page);
  await expect(page.getByText("Вопросы пропущены.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Первый шаг — уточни под себя")).toHaveValue(/10 минут/);
  await expect(page.getByLabel("Превью share-карточки")).not.toContainText("Выбрать одну посильную цель");
  await page.getByLabel("Первый шаг — уточни под себя").fill("Мой сохранённый шаг");
  await page.getByLabel("Мой план «если — то»").fill("Если устал, то выберу паузу.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Место для своего", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByLabel("Первый шаг — уточни под себя")).toHaveValue("Мой сохранённый шаг");
  await expect(page.getByLabel("Мой план «если — то»")).toHaveValue("Если устал, то выберу паузу.");
  await page.getByRole("button", { name: "Изменить ответы" }).click();
  await expect(page.getByRole("heading", { name: "Каким был твой 2026?" })).toBeVisible();
  await skip(page);
  await expect(page.getByLabel("Первый шаг — уточни под себя")).toHaveValue("Мой сохранённый шаг");
  await expect(page.getByLabel("Мой план «если — то»")).toHaveValue("Если устал, то выберу паузу.");
  await page.getByRole("button", { name: "Удалить ответы и начать заново" }).click();
  await expect(page.getByRole("button", { name: "Собрать мою карту" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("grani-new-year-2027-v1"))).toBeNull();
  expect(errors).toEqual([]);
});

test("custom answers survive back and reload, export is private by default", async ({ page }) => {
  await open(page);
  await page.getByLabel("Свой ответ", { exact: true }).check();
  await page.getByLabel("Твой ответ", { exact: true }).fill("Личная история <script> ничего не запускает");
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.getByLabel("Твой ответ", { exact: true })).toHaveValue("Личная история <script> ничего не запускает");
  await page.reload();
  await expect(page.getByLabel("Твой ответ", { exact: true })).toHaveValue("Личная история <script> ничего не запускает");
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await skip(page, 2);
  await page.getByLabel("Больше спокойствия", { exact: true }).check();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByLabel("Свой ответ", { exact: true }).check();
  await page.getByLabel("Твой ответ", { exact: true }).fill("Моя приватная цель");
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await page.getByLabel("Мало времени", { exact: true }).check();
  await page.getByRole("button", { name: "Моя карта 2027" }).click();
  const preview = page.getByLabel("Превью share-карточки");
  await expect(preview).not.toContainText("Моя приватная цель");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  const download = await downloadPromise; await download.saveAs(path.join(evidence, "share-private-default.png"));
  expect(download.suggestedFilename()).toBe("moi-grani-2027.png");
  await page.getByLabel("Добавить мою цель и первый шаг.", { exact: false }).check();
  await expect(preview).toContainText("Моя приватная цель");
  await page.getByLabel("Первый шаг — уточни под себя").fill("В субботу в 10:00 открыть расписание мастерской и выбрать пробное занятие.");
  await expect(preview).toContainText("В субботу в 10:00");
  const personalDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  await (await personalDownload).saveAs(path.join(evidence, "share-personal-opt-in.png"));
  await page.getByLabel("Добавить мою цель и первый шаг.", { exact: false }).uncheck();
  await expect(preview).not.toContainText("Моя приватная цель");
});

test("works when browser storage is blocked and profile service fails", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } }); });
  await page.route("**/api/new-year-2027/profile", (route) => route.fulfill({ status: 503, json: { status: "unavailable" } }));
  await open(page); await skip(page);
  await expect(page.getByText("Хранилище браузера недоступно.", { exact: false })).toBeVisible();
  await expect(page.getByText("Профиль сейчас недоступен.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Место для своего", exact: true, level: 1 })).toBeVisible();
});

test("native share refusal downloads a file, while cancellation stays neutral", async ({ page }) => {
  await open(page); await skip(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("activation expired", "NotAllowedError")) });
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Поделиться", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("moi-grani-2027.png");
  await expect(page.getByText("Приложение не открылось.", { exact: false })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("cancelled", "AbortError")) }));
  await page.getByRole("button", { name: "Поделиться", exact: true }).click();
  await expect(page.getByText("Отправка отменена.", { exact: false })).toBeVisible();
});

test("export failure keeps the preview and offers a retry", async ({ page }) => {
  await open(page); await skip(page);
  await page.evaluate(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  await expect(page.getByText("Не получилось сохранить карточку.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Скачать PNG" })).toBeEnabled();
  await expect(page.getByLabel("Превью share-карточки")).toBeVisible();
});

test("real local session reads its saved Big Five and never exposes identity", async ({ page }) => {
  const request = page.request;
  const guest = await request.get("/api/new-year-2027/profile?userId=someone-else");
  expect(await guest.json()).toEqual({ status: "guest" });
  expect(guest.headers()["cache-control"]).toContain("no-store");
  await request.get(`/api/dev/login?name=NewYearLocalFixture-${Date.now()}`, { maxRedirects: 0 });
  expect(await (await request.get("/api/new-year-2027/profile")).json()).toEqual({ status: "missing" });
  const response = await request.post("/api/results", { headers: { origin: new URL(guest.url()).origin }, data: { answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`ipip-${String(i + 1).padStart(2, "0")}`, 3])) } });
  expect(response.ok()).toBe(true);
  const profile = await request.get("/api/new-year-2027/profile?userId=someone-else");
  const data = await profile.json();
  expect(Object.keys(data).sort()).toEqual(["scores", "status"]);
  expect(data.status).toBe("available");
  expect(Object.values(data.scores)).toEqual([50, 50, 50, 50, 50]);
  await open(page); await skip(page);
  await expect(page.getByLabel("Учитывать мой сохранённый профиль Big Five")).toBeChecked();
  await expect(page.getByText("Варианты с учётом твоих пяти шкал", { exact: false })).toBeVisible();
  await page.getByLabel("Учитывать мой сохранённый профиль Big Five").uncheck();
  await expect(page.getByText("По твоим ответам, без профиля Big Five.", { exact: false })).toBeVisible();
});

test("long custom answers and opt-in export stay within the canvas", async ({ page }) => {
  await open(page); await skip(page, 4);
  await page.getByLabel("Свой ответ", { exact: true }).check();
  await page.getByLabel("Твой ответ", { exact: true }).fill("Ж".repeat(300));
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  await skip(page, 1);
  await page.getByLabel("Первый шаг — уточни под себя").fill("Ж".repeat(300));
  await page.getByLabel("Добавить мою цель и первый шаг.", { exact: false }).check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать PNG" }).click();
  await (await downloadPromise).saveAs(path.join(evidence, "share-long.png"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`responsive flow ${width}px with focus, no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/new-year-2027");
    await page.screenshot({ path: path.join(evidence, `intro-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Собрать мою карту" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Tab"); await page.keyboard.press("ArrowDown");
    await page.screenshot({ path: path.join(evidence, `question-${width}.png`), fullPage: true });
    await skip(page);
    await page.screenshot({ path: path.join(evidence, `result-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

const next = (page: Page) => page.getByRole("button", { name: "Дальше", exact: true }).click();
const pick = (page: Page, label: string) => page.getByLabel(label, { exact: true }).check();
async function reachStockResult(page: Page) {
  await open(page);
  await pick(page, "Год перемен"); await next(page);
  await pick(page, "За заботу о себе"); await next(page);
  await pick(page, "Спешку"); await next(page);
  await pick(page, "Больше нового"); await next(page);
  await pick(page, "Освоить новый навык"); await next(page);
  await pick(page, "Усталость");
  await page.getByRole("button", { name: "Моя карта 2027" }).click();
}
const slide = (page: Page, kicker: string) => page.locator("li", { has: page.getByRole("button", { name: `Скачать «${kicker}»` }) });
const pngSize = async (file: string) => { const buf = await readFile(file); return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; };

test("landing explains the card, is indexable and carries FAQ markup", async ({ page }) => {
  await page.goto("/new-year-2027");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  for (const name of ["Так выглядит карта", "Как это работает", "Это не гороскоп", "Частые вопросы"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Демонстрационный пример", { exact: true })).toBeVisible();
  await page.getByText("Где хранятся мои ответы?").click();
  await expect(page.getByText("На сервер они не отправляются", { exact: false }).first()).toBeVisible();
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).not.toContain("noindex");
  const types = await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => JSON.parse(n.textContent || "{}")["@type"]));
  expect(types).toContain("FAQPage");
});

test("release answer fades out, the map gains word, strength and what to leave", async ({ page }) => {
  await open(page);
  await pick(page, "Год перемен"); await next(page);
  await pick(page, "За заботу о себе"); await next(page);
  await pick(page, "Спешку"); await next(page);
  await expect(page.getByRole("status").filter({ hasText: "Оставляем это в 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Чего хочется больше в 2027?" })).toBeVisible();
});

test("reduced motion skips the pause", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await skip(page, 2);
  await pick(page, "Спешку"); await next(page);
  await expect(page.getByRole("heading", { name: "Чего хочется больше в 2027?" })).toBeVisible({ timeout: 400 });
});

test("result: word of the year, answer-shaped blocks, cards need consent when personal", async ({ page }) => {
  await reachStockResult(page);
  await expect(page.getByRole("heading", { name: "Место для нового", level: 1 })).toBeVisible();
  // Hidden labels inside the card rail once widened the whole page on phones, which makes Chrome zoom out.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByText("Слово 2027 — Любопытство", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Что оставить в 2026", level: 3 })).toBeVisible();
  await expect(page.getByText("Опора — умение помнить о заботе о себе", { exact: false }).first()).toBeVisible();
  await page.getByRole("radio", { name: "Ясность" }).check();
  await expect(page.getByText("Слово 2027 — Ясность", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Карточки карты" }).getByRole("listitem")).toHaveCount(5);
  // A stock word card has no personal text and needs no consent; every card built from answers is locked until the person agrees.
  await expect(slide(page, "Слово 2027").getByRole("button", { name: "Скачать «Слово 2027»" })).toBeEnabled();
  for (const kicker of ["Моя опора", "Оставляю в 2026", "Мой первый шаг", "Если что-то помешает"]) {
    await expect(slide(page, kicker).getByRole("button", { name: `Скачать «${kicker}»` })).toBeDisabled();
  }
  await page.getByRole("radio", { name: "Своё слово" }).check();
  await page.getByLabel("Твоё слово").fill("Мой секрет");
  await expect(slide(page, "Слово 2027").getByRole("button", { name: "Скачать «Слово 2027»" })).toBeDisabled();
  // The typed word stays off the wallpaper, and the page says so.
  await expect(page.getByRole("img", { name: /Превью обоев/ })).not.toHaveAttribute("aria-label", /Мой секрет/);
  await expect(page.getByText("Своё слово на обои не попадает", { exact: false }).first()).toBeVisible();
});

test("blank step text falls back instead of producing an empty card, and a restored custom word does not grab focus", async ({ page }) => {
  await reachStockResult(page);
  await page.getByLabel("Первый шаг — уточни под себя").fill("");
  await expect(slide(page, "Мой первый шаг").locator("[data-slide]")).toContainText("10 минут");
  await page.getByRole("radio", { name: "Своё слово" }).check();
  await page.getByLabel("Твоё слово").fill("Моё слово");
  await page.reload();
  await expect(page.getByLabel("Твоё слово")).toHaveValue("Моё слово");
  await expect(page.getByLabel("Твоё слово")).not.toBeFocused();
});

test("cards and wallpaper download with the expected file names and sizes", async ({ page }) => {
  await reachStockResult(page);
  const wordDownload = page.waitForEvent("download");
  await slide(page, "Слово 2027").getByRole("button", { name: "Скачать «Слово 2027»" }).click();
  const word = await wordDownload;
  expect(word.suggestedFilename()).toBe("moi-grani-2027-word.png");
  await word.saveAs(path.join(evidence, "card-word.png"));
  expect(await pngSize(path.join(evidence, "card-word.png"))).toEqual({ width: 1080, height: 1350 });

  await slide(page, "Мой первый шаг").getByLabel("На картинке будет мой текст", { exact: false }).check();
  const stepDownload = page.waitForEvent("download");
  await slide(page, "Мой первый шаг").getByRole("button", { name: "Скачать «Мой первый шаг»" }).click();
  const step = await stepDownload;
  expect(step.suggestedFilename()).toBe("moi-grani-2027-step.png");
  await step.saveAs(path.join(evidence, "card-step.png"));

  const wallpaperDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать обои" }).click();
  const wallpaper = await wallpaperDownload;
  expect(wallpaper.suggestedFilename()).toBe("moi-grani-2027-oboi.png");
  await wallpaper.saveAs(path.join(evidence, "wallpaper.png"));
  expect(await pngSize(path.join(evidence, "wallpaper.png"))).toEqual({ width: 1080, height: 2340 });
  await expect(page.getByText("Обои скачаны.", { exact: false })).toBeVisible();
});

test("a chosen word survives reload, and the result points to the Big Five test", async ({ page }) => {
  await reachStockResult(page);
  await page.getByRole("radio", { name: "Смелость" }).check();
  await page.reload();
  await expect(page.getByText("Слово 2027 — Смелость", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Пройти тест Big Five/ })).toHaveAttribute("href", "/test");
});
