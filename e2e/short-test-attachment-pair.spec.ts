import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueName } from "./helpers";

const ITEMS = 30;
const EMAIL = "anna@example.ru";
// Фразы, которые есть только в платном разборе пары (те же, что в packages/content report.test.ts)
const PAIR_REPORT_MARKERS = ["круг погони", "договор о паузе"];

async function answerAll(page: Page, label = "Точно про меня") {
  for (let answered = 0; answered < ITEMS; ) {
    const cards = page.locator(".question-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i++) await cards.nth(i).getByRole("radio", { name: label }).check();
    answered += count;
    await page.getByRole("button", { name: answered < ITEMS ? "Дальше" : "Узнать результат" }).click();
  }
}

// Гость проходит тест, жмёт «Пройти вдвоём», входит и получает ссылку для партнёра
async function inviterLink(page: Page, name: string): Promise<string> {
  await page.goto("/privyazannost");
  await answerAll(page);
  await page.getByRole("button", { name: "Пройти вдвоём с партнёром" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  await expect(page).toHaveURL(/\/short\/[0-9a-f-]{36}#pair$/);
  await page.getByRole("button", { name: "Получить ссылку для партнёра" }).click();
  const link = page.getByLabel("Ссылка-приглашение");
  await expect(link).toHaveValue(/\/sp\/[A-Za-z0-9_-]{24}$/);
  return link.inputValue();
}

// Партнёр в своём браузере проходит тест по ссылке, входит и соглашается объединить результаты
async function partnerJoins(browser: Browser, url: string, inviterFirstName: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${inviterFirstName} зовёт вас пройти тест на тип привязанности вдвоём`);
  await answerAll(page, "Совсем не про меня");
  await expect(page.getByTestId("short-result")).toBeVisible();
  await page.getByRole("button", { name: "Увидеть общую карту" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  await expect(page).toHaveURL(/\/sp\/[A-Za-z0-9_-]{24}$/);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Открыть общую карту" }).click();
  await expect(page).toHaveURL(/\/short-pair\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Карта пары");
  return { context, page };
}

test("two partners build a pair map, one pays, both see the report, leaving hides it", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const anna = uniqueName("Аня");
  const url = await inviterLink(page, anna);
  const boris = await partnerJoins(browser, url, anna.split(" ")[0]!, uniqueName("Борис"));
  const pairUrl = boris.page.url();

  await page.goto(pairUrl);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Карта пары");
  await expect(page.getByTestId("short-report")).toHaveCount(0);
  const map = boris.page.getByRole("img", { name: /Вы.*Аня/ });
  await expect(map).toBeVisible();
  const legend = boris.page.locator("figure figcaption").getByRole("list");
  await expect(legend.getByRole("listitem")).toHaveText(["Вы", "Аня"]);

  await boris.page.getByRole("button", { name: /^Открыть обоим за 349/ }).click();
  await boris.page.getByLabel("Почта для чека").fill(EMAIL);
  await boris.page.getByRole("button", { name: "Перейти к оплате" }).click();
  await expect(boris.page).toHaveURL(/\/dev\/pay\/fake-/);
  await boris.page.getByRole("button", { name: "Оплатить" }).click();
  await expect(boris.page).toHaveURL(/\/short-pair\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(boris.page.getByTestId("short-report")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("short-report")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Упражнения для двоих" }).or(page.getByRole("heading", { name: /в ссоре/ }).first())).toBeVisible();

  await page.getByRole("button", { name: "Выйти из пары" }).click();
  await expect(page).toHaveURL(/\/privyazannost$/);
  const gone = await boris.page.goto(pairUrl);
  expect(gone?.status()).toBe(404);
  await boris.context.close();
});

test("a payer who owns the solo report is offered the pair report at 249 rubles", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const anna = uniqueName("Аня");
  const url = await inviterLink(page, anna);
  const shortUrl = page.url().replace(/#pair$/, "");
  const boris = await partnerJoins(browser, url, anna.split(" ")[0]!, uniqueName("Борис"));
  // Личный разбор за 199 ₽ с той же страницы результата
  await page.goto(shortUrl);
  await page.getByRole("button", { name: /^Открыть за 199/ }).click();
  await page.getByLabel("Почта для чека").fill(EMAIL);
  await page.getByRole("button", { name: "Перейти к оплате" }).click();
  await page.getByRole("button", { name: "Оплатить" }).click();
  await expect(page.getByTestId("short-report")).toBeVisible({ timeout: 60_000 });

  await page.goto(boris.page.url());
  await expect(page.getByRole("button", { name: /^Открыть обоим за 249/ })).toBeVisible();
  await expect(boris.page.getByRole("button", { name: /^Открыть обоим за 349/ })).toBeVisible();
  await boris.context.close();
});

test("own invite, a stranger on the pair page and the combinations page", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const anna = uniqueName("Аня");
  const url = await inviterLink(page, anna);
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Это ваша ссылка");

  const boris = await partnerJoins(browser, url, anna.split(" ")[0]!, uniqueName("Борис"));
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Чужой"))}`);
  expect((await strangerPage.goto(boris.page.url()))?.status()).toBe(404);
  await stranger.close();
  await boris.context.close();

  await page.goto("/privyazannost/sochetaniya");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Сочетания типов привязанности в паре");
  // 10 сочетаний, «Кратко» и «Вопросы и ответы»
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(12);
  await page.getByRole("navigation", { name: "Сочетания типов" }).getByRole("link", { name: /погоня и побег/ }).click();
  await expect(page).toHaveURL(/#anxious\+avoidant$/);
  await expect(page.getByRole("heading", { name: /погоня и побег/ })).toBeInViewport();
});

test("the pricing page and the offer list the pair report at 349 and 249 rubles", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("region", { name: "Разбор пары по типу привязанности" })).toContainText("349");
  await expect(page.getByRole("region", { name: "Разбор пары по типу привязанности" })).toContainText("249");
  await page.goto("/offer");
  await expect(page.getByText(/Разбор пары по типу привязанности «Грани» — 349/)).toBeVisible();
  await expect(page.getByText(/цена — 249/)).toBeVisible();
});

test("the pair report texts are not shipped in the invite and test pages' JavaScript", async ({ page }) => {
  for (const path of ["/privyazannost", `/sp/${"a".repeat(24)}`, "/privyazannost/sochetaniya"]) {
    await page.goto(path);
    const sources = await page.evaluate(() => [...document.scripts].map((script) => script.src).filter(Boolean));
    for (const src of sources) {
      const body = await (await page.request.get(src)).text();
      for (const marker of PAIR_REPORT_MARKERS) expect(body, `${path} ${src}`).not.toContain(marker);
    }
    for (const marker of PAIR_REPORT_MARKERS) expect(await page.content()).not.toContain(marker);
  }
});
