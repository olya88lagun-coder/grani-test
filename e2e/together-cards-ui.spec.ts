import { expect, test, type Browser, type Page } from "@playwright/test";
import { BASE_URL, playCardsViaApi, uniqueName } from "./helpers";

const origin = { origin: BASE_URL };

async function signedIn(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/api/dev/login?name=${encodeURIComponent(name)}`);
  return page;
}

async function pair(anna: Page, boris: Page) {
  const created = (await (await anna.request.post("/api/together/spaces", { headers: origin })).json()) as { inviteUrl: string };
  const token = created.inviteUrl.split("/").at(-1)!;
  expect((await boris.request.post("/api/together/invite/request", { data: { token }, headers: origin })).ok()).toBe(true);
  expect((await anna.request.post("/api/together/invite/confirm", { data: { accept: true }, headers: origin })).ok()).toBe(true);
}

test("two people play cards on the screens: wait, reveal, edit flag, continue, skip, paywall, pay", async ({ browser }) => {
  test.setTimeout(240_000);
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  await pair(anna, boris);
  const secret = `тайный-ответ-${Date.now()}`;

  await anna.goto("/together");
  await boris.goto("/together");
  await expect(anna.getByRole("heading", { name: "Замечать хорошее" })).toBeVisible();
  await expect(anna.getByText("Пройдено: 0 из 159")).toBeVisible();

  // Аня отвечает; Борис видит только статус, текст до его ответа не приходит ни в сеть, ни в страницу
  await anna.getByLabel(/Какой небольшой поступок/).fill(secret);
  await anna.getByRole("button", { name: "Отправить ответ" }).click();
  await expect(anna.getByRole("heading", { name: "Ваш ответ на месте" })).toBeVisible();

  const borisCurrent = boris.waitForResponse((response) => response.url().endsWith("/api/together/cards/current") && response.request().method() === "GET");
  await boris.reload();
  expect(await (await borisCurrent).text()).not.toContain(secret);
  await expect(boris.getByText(/ответ есть\. Текст откроется/)).toBeVisible();
  expect(await boris.content()).not.toContain(secret);

  // Борис отвечает: ему сразу открывается итог; Аня после проверки видит тот же итог, а не следующую карточку
  await boris.getByLabel(/Какой небольшой поступок/).fill("Борис ответил");
  await boris.getByRole("button", { name: "Отправить ответ" }).click();
  await expect(boris.getByText("Борис ответил")).toBeVisible();
  await expect(boris.getByText(secret)).toBeVisible();
  await anna.getByRole("button", { name: "Проверить ответы" }).click();
  await expect(anna.getByText("Борис ответил")).toBeVisible();

  // Выбор для книги сохраняется и не ставит партнёру отметку «изменено»
  // Галочка меняется только после ответа сервера, поэтому click и ожидание, а не check()
  await anna.getByLabel("Хочу выбрать свой ответ для будущей книги").click();
  await expect(anna.getByLabel("Хочу выбрать свой ответ для будущей книги")).toBeChecked();
  // Галочка подтверждена сервером: после перезагрузки она на месте
  await anna.reload();
  await expect(anna.getByLabel("Хочу выбрать свой ответ для будущей книги")).toBeChecked();
  await boris.reload();
  await expect(boris.getByText(secret)).toBeVisible();
  await expect(boris.getByText("изменено")).toHaveCount(0);

  // Правка текста после раскрытия показывается партнёру отметкой
  await anna.getByRole("button", { name: "Изменить мой ответ" }).click();
  await anna.getByLabel(/Какой небольшой поступок/).fill(`${secret} (поправка)`);
  await anna.getByRole("button", { name: "Сохранить изменения" }).click();
  await boris.reload();
  await expect(boris.getByText(/· изменено/)).toBeVisible();

  // «Сделали вместе» уходит вместе с «Продолжить»; итог держится до личного «Продолжить», в том числе после перезагрузки
  await anna.getByLabel("Сделали вместе").check();
  await anna.reload();
  await expect(anna.getByRole("button", { name: "Продолжить" })).toBeVisible();
  await anna.getByLabel("Сделали вместе").check();
  await anna.getByRole("button", { name: "Продолжить" }).click();
  await expect(anna.getByText("Карточка 2")).toBeVisible();
  await expect(boris.getByText(/Отметка .*: действие сделано/)).toHaveCount(0);
  await boris.reload();
  await expect(boris.getByText(/Отметка .*: действие сделано/)).toBeVisible();
  await boris.getByRole("button", { name: "Продолжить" }).click();
  await expect(boris.getByText("Карточка 2")).toBeVisible();

  // Борис пропускает вторую карточку: итог виден ему после перезагрузки и Ане, текст не раскрывается
  await anna.getByLabel(/Какое маленькое действие/).fill("Мой ответ на вторую");
  await anna.getByRole("button", { name: "Отправить ответ" }).click();
  await boris.getByRole("button", { name: "Пропустить карточку" }).click();
  await boris.getByRole("button", { name: "Да, пропустить" }).click();
  await expect(boris.getByRole("heading", { name: "Карточка пропущена" })).toBeVisible();
  await boris.reload();
  await expect(boris.getByRole("heading", { name: "Карточка пропущена" })).toBeVisible();
  await anna.reload();
  await expect(anna.getByRole("heading", { name: "Карточка пропущена" })).toBeVisible();
  await expect(anna.getByText("Только вам")).toBeVisible();
  for (const page of [boris, anna]) await page.getByRole("button", { name: "Продолжить" }).click();

  // История и прогресс
  await expect(anna.getByText("Пройдено: 2 из 159")).toBeVisible();
  await anna.getByRole("button", { name: "История карточек" }).click();
  await expect(anna.getByText("Карточка 2 · пропущена")).toBeVisible();
  await expect(anna.getByText("Карточка 1 · ответы открыты")).toBeVisible();

  // Платная карточка закрыта, пока нет доступа; после оплаты возвращаемся к той же карточке
  await playCardsViaApi(anna, boris, 1);
  await anna.reload();
  await boris.reload();
  await expect(boris.getByRole("heading", { name: "Продолжите вдвоём" })).toBeVisible();
  await expect(boris.getByRole("button", { name: "Пропустить карточку" })).toHaveCount(0);
  const lockedTitle = await boris.locator("[data-card-heading]").innerText();
  await boris.getByLabel("Электронная почта для чека").fill("anna@example.ru");
  await boris.getByRole("button", { name: "Перейти к оплате 599 ₽" }).click();
  await expect(boris).toHaveURL(/\/dev\/pay\/fake-/);
  await boris.getByRole("button", { name: "Оплатить" }).click();
  await expect(boris.getByRole("heading", { name: "Доступ открыт для двоих" })).toBeVisible({ timeout: 60_000 });
  await expect(boris.getByRole("heading", { name: lockedTitle })).toBeVisible();
  await expect(boris.getByRole("button", { name: "Отправить ответ" })).toBeVisible();

  // Выход закрывает карточки для обоих
  await boris.getByRole("button", { name: "Выйти из пространства" }).click();
  await boris.getByLabel("Я понимаю последствия").check();
  await boris.getByRole("button", { name: "Выйти из пространства" }).last().click();
  await expect(boris.getByRole("button", { name: "Создать и получить приглашение" })).toBeVisible();
  await anna.reload();
  await expect(anna.getByRole("button", { name: "Создать и получить приглашение" })).toBeVisible();
});

test("an edit that started before the reveal is not silently turned into an edit after it", async ({ browser }) => {
  test.setTimeout(120_000);
  const anna = await signedIn(browser, uniqueName("Аня"));
  const boris = await signedIn(browser, uniqueName("Борис"));
  await pair(anna, boris);

  await anna.goto("/together");
  await anna.getByLabel(/Какой небольшой поступок/).fill("Первый вариант Ани");
  await anna.getByRole("button", { name: "Отправить ответ" }).click();
  await expect(anna.getByRole("heading", { name: "Ваш ответ на месте" })).toBeVisible();

  // Аня начинает править, а Борис за это время отвечает: ответы открываются
  await anna.getByRole("button", { name: "Изменить ответ" }).click();
  await anna.getByLabel(/Какой небольшой поступок/).fill("Исправленный вариант Ани");
  const current = (await (await boris.request.get("/api/together/cards/current")).json()) as { card: { id: string } };
  expect((await boris.request.put(`/api/together/cards/${current.card.id}/answer`, { data: { fields: { answer: "Борис ответил" } }, headers: origin })).ok()).toBe(true);

  // Аня возвращается на вкладку: набранный текст сохранён, о раскрытии сказано явно
  await anna.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(anna.getByText(/Пока вы правили, ответы открылись\. Партнёр уже мог прочитать/)).toBeVisible();
  await expect(anna.getByLabel(/Какой небольшой поступок/)).toHaveValue("Исправленный вариант Ани");

  // Сохранение осознанное, и результат назван правдиво
  await anna.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(anna.getByText(/партнёр увидел прежний текст, а ваша правка отмечена как изменение/)).toBeVisible();
  await expect(anna.getByText("Исправленный вариант Ани")).toBeVisible();
});
