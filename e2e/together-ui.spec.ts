import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueName } from "./helpers";

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
