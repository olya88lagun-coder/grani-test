import { expect, test } from "@playwright/test";
import { answerSelfTest, BASE_URL, signedInWithResult, uniqueName } from "./helpers";

test("a partner takes the test, consents, both see the pair, leaving hides it for both", async ({ browser }) => {
  const anna = await signedInWithResult(browser, uniqueName("Аня"));
  const resultUrl = anna.page.url();
  await anna.page.getByRole("button", { name: "Позвать партнёра" }).click();
  const link = anna.page.locator(`section[data-palette="pair"]`).getByRole("textbox", { name: "Ссылка-приглашение" });
  await expect(link).toHaveValue(/\/p\/[A-Za-z0-9_-]{24}$/);
  const inviteUrl = await link.inputValue();

  const borisContext = await browser.newContext();
  const boris = await borisContext.newPage();
  await boris.goto(inviteUrl);
  await expect(boris.getByRole("heading", { name: /зовёт вас пройти тест на совместимость/ })).toBeVisible();
  await boris.getByRole("link", { name: "Пройти тест" }).click();
  await answerSelfTest(boris);
  await expect(boris).toHaveURL(/\/login$/);
  await boris.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Борис"))}`);

  // После входа партнёр возвращается к согласию, а не на свой результат
  await expect(boris).toHaveURL(inviteUrl);
  const accept = boris.getByRole("button", { name: "Узнать совместимость" });
  await expect(accept).toBeDisabled();
  await boris.getByRole("checkbox").check();
  await accept.click();
  await expect(boris).toHaveURL(/\/pair\/[0-9a-f-]{36}$/);
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
  await expect(anna.page.getByText(/^Вы · Аня/)).toBeVisible();

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
  const inviteUrl = await anna.page.locator(`section[data-palette="pair"]`).getByRole("textbox", { name: "Ссылка-приглашение" }).inputValue();
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
