import { expect, test, type Page } from "@playwright/test";
import { BASE_URL, signedInWithResult, uniqueName } from "./helpers";

const GENERATION_TIMEOUT = 60_000;

async function payOnFakePage(page: Page) {
  await expect(page).toHaveURL(/\/dev\/pay\/fake-/);
  await page.getByRole("button", { name: "Оплатить" }).click();
}

test("buys the full report and all chapters, sees them generated", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await signedInWithResult(browser, uniqueName("Аня"));
  const resultUrl = page.url();

  await expect(page.getByRole("heading", { name: "Что откроется в полном разборе" })).toBeVisible();
  await page.getByRole("button", { name: /^Открыть за 299/ }).click();
  await payOnFakePage(page);
  await expect(page).toHaveURL(/\/report\/[0-9a-f-]{36}$/, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Портрет" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Как со мной работать" })).toBeVisible();
  await expect(page.getByText("Ответили 0 из 3")).toBeVisible();
  await expect(page.getByText("Материалы для самопознания, не психологическая и не медицинская диагностика.")).toBeVisible();

  await page.getByRole("button", { name: /^Все четыре главы/ }).click();
  await payOnFakePage(page);
  await expect(page).toHaveURL(/\/report\//, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByText("Готовим главу", { exact: false })).toHaveCount(0, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByRole("button", { name: /^Глава «/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Все четыре главы/ })).toHaveCount(0);

  // На результате вместо превью — ссылка на разбор, покупка второй раз не предлагается
  await page.goto(resultUrl);
  await expect(page.getByRole("heading", { name: "Разбор открыт" })).toBeVisible();

  const card = await page.request.get(`${resultUrl.replace("/result/", "/cards/manual/")}`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");

  await context.close();
});

test("a canceled payment opens nothing", async ({ browser }) => {
  const { context, page } = await signedInWithResult(browser, uniqueName("Вера"));
  const resultId = page.url().split("/").at(-1)!;

  await page.getByRole("button", { name: /^Открыть за 299/ }).click();
  await expect(page).toHaveURL(/\/dev\/pay\/fake-/);
  await page.getByRole("button", { name: "Отменить" }).click();

  await expect(page.getByRole("heading", { name: "Оплата не прошла" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await page.goto(`/report/${resultId}`);
  await expect(page).toHaveURL(new RegExp(`/result/${resultId}$`));

  await context.close();
});

test("one payment opens the pair report to both, the price comes from the server", async ({ browser }) => {
  test.setTimeout(180_000);
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  const invite = await anna.page.request.post("/api/pairs/invites", { data: { resultId: anna.page.url().split("/").at(-1) }, headers: { origin: BASE_URL } });
  const token = ((await invite.json()) as { url: string }).url.split("/").at(-1);
  const boris = await signedInWithResult(browser, uniqueName("Борис"));
  const accepted = await boris.page.request.post("/api/pairs/accept", { data: { token, consent: true }, headers: { origin: BASE_URL } });
  const pairUrl = ((await accepted.json()) as { redirect: string }).redirect;

  // Клиент не может задать сумму: лишние поля тела игнорируются, цена — из прайса
  const tampered = await boris.page.request.post("/api/purchases", {
    data: { product: "pair", targetId: pairUrl.split("/").at(-1), amountKopecks: 100 },
    headers: { origin: BASE_URL },
  });
  const payUrl = ((await tampered.json()) as { url: string }).url;
  await boris.page.goto(payUrl);
  await expect(boris.page.getByRole("heading", { name: "399 ₽" })).toBeVisible();
  await boris.page.getByRole("button", { name: "Оплатить" }).click();

  await expect(boris.page).toHaveURL(new RegExp(`${pairUrl}$`), { timeout: GENERATION_TIMEOUT });
  await expect(boris.page.getByRole("heading", { name: "В чём вы похожи" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await expect(boris.page.getByRole("button", { name: /^Личный разбор/ })).toBeVisible();

  await anna.page.goto(pairUrl);
  await expect(anna.page.getByRole("heading", { name: "В чём вы похожи" })).toBeVisible();
  await expect(anna.page.getByRole("button", { name: /^Открыть разбор пары/ })).toHaveCount(0);

  await anna.context.close();
  await boris.context.close();
});
