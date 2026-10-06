import { expect, test, type Browser, type Page } from "@playwright/test";
import { BASE_URL, playCardsViaApi, uniqueName } from "./helpers";

const EMAIL = "anna@example.ru";

// Заход через страницу «Вдвоём»: «Войти» запоминает, куда вернуть, dev-вход заменяет VK ID на локальной машине
async function signInThrough(page: Page, entry: string, name: string) {
  await page.goto(entry);
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
}

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test("two people go from the sign-in to a paid space through the screens", async ({ browser }) => {
  test.setTimeout(180_000);
  const annaName = uniqueName("Аня");
  const borisName = uniqueName("Борис");
  const anna = await newPage(browser);
  const boris = await newPage(browser);

  // Публичная страница ведёт во вход и возвращает на себя после входа
  await anna.goto("/together");
  await expect(anna.getByRole("heading", { name: "Начнём с вас двоих" })).toBeVisible();
  // Витрина: маршрут на полгода с вопросами из месяцев
  await expect(anna.getByRole("heading", { name: "Маршрут на полгода" })).toBeVisible();
  await expect(anna.getByText("Наша история")).toBeVisible();
  await expect(anna.getByText("Свидание за 0 ₽ и 30 минут: какое?")).toBeVisible();
  await anna.getByRole("link", { name: "Создать пространство для двоих" }).click();
  await expect(anna).toHaveURL(/\/login/);
  await anna.goto(`/api/dev/login?name=${encodeURIComponent(annaName)}`);
  await expect(anna).toHaveURL(/\/together$/);

  await anna.getByRole("button", { name: "Создать и получить приглашение" }).click();
  await expect(anna.getByRole("heading", { name: "Ваше приглашение готово" })).toBeVisible();
  const inviteUrl = await anna.getByLabel("Личная ссылка").inputValue();
  expect(inviteUrl).toMatch(/\/together\/invite\/[A-Za-z0-9_-]{24}$/);
  const invitePath = new URL(inviteUrl).pathname;

  // Партнёр: ссылка ведёт во вход и возвращает на приглашение; запрос идемпотентен после обновления страницы
  await boris.goto(invitePath);
  await expect(boris.getByRole("heading", { name: "Время для вас двоих" })).toBeVisible();
  await boris.getByRole("link", { name: "Войти и продолжить" }).click();
  await expect(boris).toHaveURL(/\/login/);
  await boris.goto(`/api/dev/login?name=${encodeURIComponent(borisName)}`);
  await expect(boris).toHaveURL(new RegExp(`${invitePath}$`));
  await boris.getByRole("button", { name: "Отправить запрос на участие" }).click();
  await expect(boris.getByRole("heading", { name: "Осталось подтверждение" })).toBeVisible();
  await boris.reload();
  await expect(boris.getByRole("button", { name: "Отправить запрос на участие" })).toBeVisible();
  await boris.getByRole("button", { name: "Отправить запрос на участие" }).click();
  await expect(boris.getByRole("heading", { name: "Осталось подтверждение" })).toBeVisible();

  // Инициатор видит имя и подтверждает
  await anna.goto("/together");
  await expect(anna.getByRole("heading", { name: "Это ваш человек?" })).toBeVisible();
  await expect(anna.getByText(borisName)).toBeVisible();
  await anna.getByRole("button", { name: "Да, подтвердить партнёра" }).click();
  await expect(anna.getByRole("heading", { name: "Вы теперь вдвоём" })).toBeVisible();

  // Партнёр узнаёт о подтверждении и оплачивает; успех показывается только после проверки на сервере
  await boris.getByRole("button", { name: "Проверить подтверждение" }).click();
  await expect(boris.getByRole("heading", { name: "Вы теперь вдвоём" })).toBeVisible();
  // Оплата предлагается в закрытой карточке: три вводные бесплатны, до платной пара доходит через API
  await expect(boris.getByRole("heading", { name: "Замечать хорошее" })).toBeVisible();
  await playCardsViaApi(anna, boris, 3);
  await boris.reload();
  await expect(boris.getByRole("heading", { name: "Продолжите вдвоём" })).toBeVisible();
  await boris.getByLabel("Электронная почта для чека").fill(EMAIL);
  await boris.getByRole("button", { name: "Перейти к оплате 599 ₽" }).click();
  await expect(boris).toHaveURL(/\/dev\/pay\/fake-/);
  await boris.getByRole("button", { name: "Оплатить" }).click();
  await expect(boris).toHaveURL(/\/together\?purchase=/);
  await expect(boris.getByRole("heading", { name: "Доступ открыт для двоих" })).toBeVisible({ timeout: 60_000 });
  await expect(boris.getByText(/Доступ действует до/)).toBeVisible();

  await anna.reload();
  await expect(anna.getByText(/Доступ действует до/)).toBeVisible();

  // Выход только после подтверждения последствий, затем пространство закрыто для обоих
  await anna.getByRole("button", { name: "Выйти из пространства" }).click();
  const confirmLeave = anna.getByRole("button", { name: "Выйти из пространства" });
  await expect(confirmLeave).toBeDisabled();
  await anna.getByLabel("Я понимаю последствия").check();
  await confirmLeave.click();
  await expect(anna.getByRole("button", { name: "Создать и получить приглашение" })).toBeVisible();
  await boris.goto("/together");
  await expect(boris.getByRole("button", { name: "Создать и получить приглашение" })).toBeVisible();
});

test("an unusable invite link shows a neutral page and the private pages are not indexed", async ({ browser }) => {
  const page = await newPage(browser);

  await page.goto("/together/invite/AAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "Эта ссылка сейчас недоступна" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");

  await page.goto("/together");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  await signInThrough(page, "/api/together/enter?next=space", uniqueName("Вера"));
  await expect(page).toHaveURL(/\/together$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the invite page shows the inviter's first name, the note and the first question before any sign-in", async ({ browser }) => {
  const anna = await newPage(browser);
  await anna.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Аня"))}`);
  await anna.goto("/together");
  await anna.getByRole("button", { name: "Создать и получить приглашение" }).click();
  await expect(anna.getByRole("heading", { name: "Ваше приглашение готово" })).toBeVisible();
  const invitePath = new URL(await anna.getByLabel("Личная ссылка").inputValue()).pathname;

  await anna.getByLabel("Записка партнёру (необязательно)").fill("Давай попробуем вместе");
  await anna.getByRole("button", { name: "Сохранить записку" }).click();
  await expect(anna.getByText("Записка сохранена.")).toBeVisible();

  const guest = await newPage(browser);
  await guest.goto(invitePath);
  await expect(guest.getByText("Аня приглашает вас")).toBeVisible();
  await expect(guest.getByText("Давай попробуем вместе")).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Первый вопрос" })).toBeVisible();
  await expect(guest.getByRole("link", { name: "Войти и продолжить" })).toBeVisible();
  // Фамилия и остальное имя не раскрываются
  await expect(guest.getByText(/Аня \d/)).toHaveCount(0);
});

test("an active pair gets a link for friends; a friend who comes by it keeps the code until the space is created", async ({ browser }) => {
  test.setTimeout(120_000);
  const headers = { origin: BASE_URL };
  const anna = await newPage(browser);
  const boris = await newPage(browser);
  await anna.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Аня"))}`);
  await boris.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Борис"))}`);
  const created = (await (await anna.request.post("/api/together/spaces", { headers })).json()) as { inviteUrl: string };
  expect((await boris.request.post("/api/together/invite/request", { data: { token: created.inviteUrl.split("/").at(-1) }, headers })).status()).toBe(200);
  expect((await anna.request.post("/api/together/invite/confirm", { data: { accept: true }, headers })).status()).toBe(200);

  // Ссылка для друзей: на экране активного пространства
  await anna.goto("/together");
  await anna.getByText("Поделиться с парой друзей").click();
  await anna.getByRole("button", { name: "Получить ссылку" }).click();
  const link = await anna.getByLabel("Ссылка для друзей").inputValue();
  expect(link).toMatch(/\/together\?from=[a-z2-9]{10}$/);

  // Друг приходит по ссылке: код запоминается при входе и стирается после создания пространства
  const vera = await newPage(browser);
  await vera.goto(new URL(link).pathname + new URL(link).search);
  await expect(vera.getByRole("heading", { name: "Начнём с вас двоих" })).toBeVisible();
  await vera.getByRole("link", { name: "Создать пространство для двоих" }).click();
  await expect(vera).toHaveURL(/\/login/);
  await vera.goto(`/api/dev/login?name=${encodeURIComponent(uniqueName("Вера"))}`);
  await expect(vera).toHaveURL(/\/together$/);
  const cookieNames = async () => (await vera.context().cookies()).map((cookie) => cookie.name);
  expect(await cookieNames()).toContain("grani_together_from");
  await vera.getByRole("button", { name: "Создать и получить приглашение" }).click();
  await expect(vera.getByRole("heading", { name: "Ваше приглашение готово" })).toBeVisible();
  expect(await cookieNames()).not.toContain("grani_together_from");
});
