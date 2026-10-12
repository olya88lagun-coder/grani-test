import { expect, type Browser, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "./together-fixture";
import { BASE_URL, uniqueName } from "./helpers";

const origin = { origin: BASE_URL };
const require = createRequire(resolve("packages/db/package.json"));

function localDb() {
  const address = process.env.E2E_DATABASE_URL;
  if (!address) throw new Error("Set E2E_DATABASE_URL explicitly to the isolated P1 test database");
  const url = new URL(address);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/postgres") throw new Error("Only the isolated localhost:5442 database is allowed");
  return require("postgres")(address, { max: 1, prepare: false });
}

async function pair(browser: Browser, prefix: string) {
  const contexts = [await browser.newContext(), await browser.newContext()];
  const first = await contexts[0]!.newPage(), second = await contexts[1]!.newPage();
  for (const [page, name] of [[first, `${prefix}Аня`], [second, `${prefix}Борис`]] as const) {
    await page.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName(name))}`);
    await page.evaluate(() => localStorage.setItem("grani-cookie-consent", "necessary"));
  }
  const created = await (await first.request.post("/api/together/spaces", { data: { consent: true }, headers: origin })).json();
  expect((await second.request.post("/api/together/invite/request", { data: { token: created.inviteUrl.split("/").at(-1), consent: true }, headers: origin })).ok()).toBe(true);
  expect((await first.request.post("/api/together/invite/confirm", { data: { accept: true }, headers: origin })).ok()).toBe(true);
  return { first, second, spaceId: created.spaceId, close: () => Promise.all(contexts.map((context) => context.close())) };
}

test("another active pair cannot read or mutate revealed cards, history or purchases", async ({ browser }) => {
  const own = await pair(browser, "Своя"), foreign = await pair(browser, "Чужая");
  try {
    const current = await (await own.first.request.get("/api/together/cards/current")).json();
    const id = current.card.id, secret = `Приватный ответ ${Date.now()}`;
    for (const [page, answer] of [[own.first, secret], [own.second, "Ответ своего партнёра"]] as const) {
      expect((await page.request.put(`/api/together/cards/${id}/answer`, { data: { fields: { answer } }, headers: origin })).ok()).toBe(true);
    }
    const purchase = await (await own.first.request.post("/api/together/purchases", { data: { email: "synthetic@example.ru" }, headers: origin })).json();
    for (const page of [foreign.first, foreign.second]) {
      expect((await page.request.put(`/api/together/cards/${id}/answer`, { data: { fields: { answer: "Подмена чужого ответа" } }, headers: origin })).status()).toBe(404);
      expect((await page.request.post(`/api/together/cards/${id}/continue`, { data: {}, headers: origin })).status()).toBe(404);
      expect((await page.request.post(`/api/together/cards/${id}/skip`, { data: {}, headers: origin })).status()).toBe(404);
      expect((await page.request.get(`/api/together/purchases/${purchase.purchaseId}`)).status()).toBe(404);
      for (const path of ["/api/together/cards/current", "/api/together/history", "/api/together/care"]) expect(await (await page.request.get(path)).text()).not.toContain(secret);
    }
    expect((await (await own.first.request.get("/api/together/cards/current")).json()).card.mine.fields.answer).toBe(secret);
  } finally { await own.close(); await foreign.close(); }
});

test("one fake 399-ruble payment grants both exactly 30 days and duplicate confirmation preserves the period", async ({ browser }) => {
  const own = await pair(browser, "Оплата"), sql = localDb();
  try {
    const purchase = await (await own.first.request.post("/api/together/purchases", { data: { email: "synthetic@example.ru" }, headers: origin })).json();
    const paymentId = purchase.url.split("/dev/pay/")[1];
    const pay = () => own.first.request.post(`/api/dev/pay/${paymentId}`, { form: { outcome: "succeeded" }, headers: origin, maxRedirects: 0 });
    expect((await pay()).status()).toBe(303);
    const before = await sql`select * from together_access_periods where purchase_id = ${purchase.purchaseId}`;
    expect(before).toHaveLength(1);
    expect(new Date(before[0].ends_at).getTime() - new Date(before[0].starts_at).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect((await pay()).status()).toBe(303);
    expect(await sql`select * from together_access_periods where purchase_id = ${purchase.purchaseId}`).toEqual(before);
    expect(await sql`select amount_kopecks, status from purchases where id = ${purchase.purchaseId}`).toMatchObject([{ amount_kopecks: 39900, status: "succeeded" }]);
    for (const page of [own.first, own.second]) {
      const view = await (await page.request.get("/api/together/space")).json();
      expect(view.space.access.active).toBe(true);
      expect(new Date(view.space.access.accessUntil)).toEqual(before[0].ends_at);
    }
  } finally { await sql.end(); await own.close(); }
});

test("synthetic historical snapshots, answers and an expired purchase survive P1 history rendering unchanged", async ({ browser }) => {
  const own = await pair(browser, "Архив"), sql = localDb();
  try {
    const current = await (await own.first.request.get("/api/together/cards/current")).json();
    const id = current.card.id;
    for (const [page, answer] of [[own.first, "Сохранённый ответ Анны"], [own.second, "Сохранённый ответ Бориса"]] as const) {
      expect((await page.request.put(`/api/together/cards/${id}/answer`, { data: { fields: { answer } }, headers: origin })).ok()).toBe(true);
      if (page === own.first) expect(await (await own.second.request.get("/api/together/cards/current")).text()).not.toContain(answer);
    }
    for (const page of [own.first, own.second]) expect((await page.request.post(`/api/together/cards/${id}/continue`, { data: {}, headers: origin })).ok()).toBe(true);
    const purchase = await (await own.first.request.post("/api/together/purchases", { data: { email: "synthetic@example.ru" }, headers: origin })).json();
    expect((await own.first.request.post(`/api/dev/pay/${purchase.url.split("/dev/pay/")[1]}`, { form: { outcome: "succeeded" }, headers: origin, maxRedirects: 0 })).status()).toBe(303);
    // Только синтетические записи в отдельной БД: моделируем выданный ранее snapshot и истёкшую оплату.
    await sql`update together_cards set snapshot = jsonb_set(jsonb_set(snapshot, '{title}', '"Старое название из снимка"'), '{prompt}', '"Старый вопрос из снимка?"'), created_at = '2026-09-01T10:00:00Z', closed_at = '2026-09-01T10:10:00Z' where id = ${id}`;
    await sql`update together_answers set created_at = '2026-09-01T10:01:00Z', updated_at = '2026-09-01T10:02:00Z', revision = 2 where card_id = ${id}`;
    await sql`update purchases set paid_at = '2026-09-01T10:00:00Z' where id = ${purchase.purchaseId}`;
    await sql`update together_access_periods set starts_at = '2026-09-01T10:00:00Z', ends_at = '2026-10-01T10:00:00Z' where purchase_id = ${purchase.purchaseId}`;
    const stored = async () => ({ cards: await sql`select * from together_cards where space_id = ${own.spaceId} order by position`, answers: await sql`select * from together_answers where space_id = ${own.spaceId} order by id`, purchases: await sql`select * from purchases where space_id = ${own.spaceId} order by id`, periods: await sql`select * from together_access_periods where space_id = ${own.spaceId} order by id` });
    const before = await stored();
    for (const page of [own.first, own.second]) {
      await page.goto("/together");
      await expect(page.getByText(/Доступ закончился/)).toBeVisible();
      await page.getByRole("button", { name: "История карточек" }).click();
      await page.getByRole("button", { name: /Старое название из снимка/ }).click();
      const dialog = page.getByRole("dialog", { name: "Старое название из снимка" });
      await expect(dialog.getByText("Старый вопрос из снимка?", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Сохранённый ответ Анны", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Сохранённый ответ Бориса", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.reload();
    }
    expect(await stored()).toEqual(before);
  } finally { await sql.end(); await own.close(); }
});
