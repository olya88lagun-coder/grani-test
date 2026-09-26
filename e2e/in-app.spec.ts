import { expect, test } from "@playwright/test";
import { answerSelfTest, BASE_URL, uniqueName } from "./helpers";

// Встроенный браузер ВКонтакте на iPhone: вход через VK ID там зацикливается, поэтому сайт просит открыть его в Safari
const VK_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 com.vk.vkclient/9.0";

test("a result taken in the VK app browser moves to Safari by the page link", async ({ browser }) => {
  test.setTimeout(120_000);
  const vk = await browser.newContext({ userAgent: VK_IPHONE });
  const inApp = await vk.newPage();

  await inApp.goto("/test");
  await expect(inApp.getByRole("heading", { name: "Откройте сайт в Safari или Chrome" })).toBeVisible();
  await answerSelfTest(inApp);

  // Страница входа сразу подменяет адрес ссылкой переноса — её и откроет «Открыть в Safari»
  await expect(inApp.getByText("внутри приложения ВКонтакте")).toBeVisible();
  await expect(inApp).toHaveURL(/\/continue\/[A-Za-z0-9_-]{24}$/);
  const handoffUrl = inApp.url();
  await vk.close();

  const safari = await browser.newContext();
  const page = await safari.newPage();
  await page.goto(handoffUrl);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Результат посчитан")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Откройте сайт в Safari или Chrome" })).toHaveCount(0);

  await page.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Сафари"))}`);
  await expect(page).toHaveURL(/\/result\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Вдохновитель" })).toBeVisible();
  await safari.close();
});

test("an unknown transfer link explains what happened", async ({ page }) => {
  await page.goto(`${BASE_URL}/continue/AAAAAAAAAAAAAAAAAAAAAAAA`);
  await expect(page).toHaveURL(/\/login\?error=handoff_expired$/);
  // Только текст: у Next на странице бывает свой пустой role="alert" для объявлений о переходах
  await expect(page.getByText("Ссылка для переноса результата устарела", { exact: false })).toBeVisible();
});
