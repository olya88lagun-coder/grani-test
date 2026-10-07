import { expect, test, type Browser, type Page } from "@playwright/test";
import { BASE_URL, uniqueName } from "./helpers";

// Сценарий для сервера в режиме закрытого пилота: TOGETHER_MODE=pilot TOGETHER_PILOT_CODE=<код> (тот же код нужен и этому процессу)
const CODE = process.env.TOGETHER_PILOT_CODE ?? "";
test.skip(process.env.TOGETHER_MODE !== "pilot" || CODE === "", "Нужен сервер с TOGETHER_MODE=pilot и TOGETHER_PILOT_CODE");

const origin = { origin: BASE_URL };

async function signedIn(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

test("the pilot lets in people with the code or an invite and shows outsiders nothing of the offer", async ({ browser }) => {
  test.setTimeout(120_000);

  // Гость: нейтральная страница, без витрины, без индексации
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/together");
  await expect(visitor.getByRole("heading", { name: "Закрытый пилот" })).toBeVisible();
  await expect(visitor.getByText("Маршрут на полгода")).toHaveCount(0);
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // Вошедший без пропуска: форма кода, закрытые маршруты, неверный код ничего не открывает
  const anna = await signedIn(browser, uniqueName("Аня"));
  await anna.goto("/together");
  await expect(anna.getByLabel("Код доступа")).toBeVisible();
  expect((await anna.request.get("/api/together/space")).status()).toBe(403);
  expect((await anna.request.post("/api/together/spaces", { headers: origin })).status()).toBe(403);
  const wrong = await anna.request.post("/api/together/pilot", { data: { code: "неверный-код" }, headers: origin });
  expect(wrong.status()).toBe(403);
  expect(await wrong.json()).toEqual({ ok: false, error: "invalid_code" });
  expect((await anna.request.get("/api/together/space")).status()).toBe(403);

  // Верный код с экрана открывает обычное пространство
  await anna.getByLabel("Код доступа").fill(CODE);
  await anna.getByRole("button", { name: "Войти по коду" }).click();
  await anna.getByRole("checkbox", { name: /Мне есть 18 лет/ }).check();
  await anna.getByRole("button", { name: "Создать и получить приглашение" }).click();
  await expect(anna.getByRole("heading", { name: "Ваше приглашение готово" })).toBeVisible();
  const invitePath = new URL(await anna.getByLabel("Личная ссылка").inputValue()).pathname;

  // Партнёр по приглашению входит без кода; до запроса пропуска у него нет
  const boris = await signedIn(browser, uniqueName("Борис"));
  expect((await boris.request.get("/api/together/space")).status()).toBe(403);
  await boris.goto(invitePath);
  await boris.getByRole("checkbox", { name: /Мне есть 18 лет/ }).check();
  await boris.getByRole("button", { name: "Отправить запрос на участие" }).click();
  await expect(boris.getByRole("heading", { name: "Осталось подтверждение" })).toBeVisible();
  expect((await anna.request.post("/api/together/invite/confirm", { data: { accept: true }, headers: origin })).status()).toBe(200);
  const space = await boris.request.get("/api/together/space");
  expect(space.status()).toBe(200);

  // Человек с неверной ссылкой пропуска не получает
  const vera = await signedIn(browser, uniqueName("Вера"));
  const refused = await vera.request.post("/api/together/invite/request", { data: { token: "x".repeat(24), consent: true }, headers: origin });
  expect(refused.status()).toBe(404);
  expect((await vera.request.get("/api/together/space")).status()).toBe(403);
});
