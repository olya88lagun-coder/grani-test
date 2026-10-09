import { expect, test } from "@playwright/test";
import { answerSelfTest, BASE_URL, signedInWithResult, uniqueName } from "./helpers";

test("a partner takes the test, consents, both see the pair, leaving hides it for both", async ({ browser }) => {
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  const resultUrl = anna.page.url();
  await anna.page.getByRole("button", { name: "Позвать партнёра" }).click();
  const link = anna.page.getByRole("region", { name: "Посмотреть, как вы сочетаетесь" }).getByRole("textbox", { name: "Ссылка-приглашение" });
  await expect(link).toHaveValue(/\/p\/[A-Za-z0-9_-]{24}$/);
  const inviteUrl = await link.inputValue();

  const borisContext = await browser.newContext();
  const boris = await borisContext.newPage();
  await boris.goto(inviteUrl);
  await expect(boris.getByRole("heading", { name: /зовёт вас пройти тест на совместимость/ })).toBeVisible();
  await boris.getByRole("link", { name: "Пройти тест" }).click();
  await answerSelfTest(boris);
  await expect(boris).toHaveURL(/\/login$/);
  // Приглашение пары важнее посчитанного результата: вход ведёт к согласию, и вступление говорит о сравнении
  await expect(boris.getByRole("heading", { level: 1, name: "Продолжим сравнение" })).toBeVisible();
  await boris.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Борис"))}`);

  // После входа партнёр возвращается к согласию, а не на свой результат
  await expect(boris).toHaveURL(inviteUrl);
  const accept = boris.getByRole("button", { name: "Узнать совместимость" });
  await expect(accept).toBeDisabled();
  await boris.getByRole("checkbox").check();
  await accept.click();
  // На первом заходе next dev компилирует создание пары и её страницу.
  await expect(boris).toHaveURL(/\/pair\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const pairUrl = boris.url();
  await expect(boris.locator(".pair-score")).toHaveText(/^\d{1,3}%$/);
  // Та же мысль есть в тексте уровня совместимости, поэтому ищем дисклеймер по его продолжению
  await expect(boris.getByText("Это не прогноз отношений: число показывает", { exact: false })).toBeVisible();

  // Ссылка одноразовая, пара видна пригласившей
  await anna.page.goto(inviteUrl);
  await expect(anna.page.getByRole("heading", { name: "Ссылка уже использована" })).toBeVisible();
  await anna.page.goto(resultUrl);
  await anna.page.getByRole("link", { name: /^Пара: вы и Борис/ }).click();
  await expect(anna.page).toHaveURL(pairUrl);
  await expect(anna.page.locator(".pair-person").getByText(/^Вы · Аня/)).toBeVisible();

  // Выход любого из двоих скрывает пару у обоих
  await boris.getByText("Выйти из пары", { exact: true }).first().click();
  await boris.getByRole("button", { name: "Выйти из пары" }).click();
  await expect(boris).toHaveURL(/\/result\/[0-9a-f-]{36}$/);
  expect((await anna.page.goto(pairUrl))?.status()).toBe(404);
  expect((await boris.goto(pairUrl))?.status()).toBe(404);

  await borisContext.close();
  await anna.context.close();
});

test("a pair is not created without consent", async ({ browser }) => {
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  await anna.page.getByRole("button", { name: "Позвать партнёра" }).click();
  const inviteUrl = await anna.page.getByRole("region", { name: "Посмотреть, как вы сочетаетесь" }).getByRole("textbox", { name: "Ссылка-приглашение" }).inputValue();
  const token = inviteUrl.split("/").at(-1);

  const vera = await signedInWithResult(browser, uniqueName("Вера"));
  const response = await vera.page.request.post("/api/pairs/accept", {
    data: { token, consent: false },
    headers: { origin: BASE_URL },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ ok: false, error: "consent_required" });
  await vera.page.goto(inviteUrl);
  await expect(vera.page.getByRole("checkbox")).toBeVisible();

  await vera.context.close();
  await anna.context.close();
});

test("the compatibility page leads a newcomer to the test and a returning user to the invite", async ({ browser, page }) => {
  await page.goto("/compatibility");
  await page.getByRole("link", { name: "Пройти тест" }).first().click();
  await expect(page).toHaveURL(/\/test$/);

  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  await anna.page.goto("/compatibility");
  await anna.page.getByRole("link", { name: "Уже прошли — позвать партнёра" }).first().click();
  await expect(anna.page).toHaveURL(/\/result\/[0-9a-f-]{36}#pairs$/);
  await expect(anna.page.getByRole("button", { name: "Позвать партнёра" })).toBeInViewport();
  await anna.context.close();
});

