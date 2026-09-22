import { expect, test } from "@playwright/test";
import { answerAll, signedInWithResult, uniqueName } from "./helpers";

const answerFriendForm = (page: import("@playwright/test").Page) =>
  answerAll(page, { pages: 5, perPage: 4, label: "Скорее про меня", submit: "Отправить ответы" });

test("three friends answer anonymously and the owner sees the comparison", async ({ browser }) => {
  const owner = await signedInWithResult(browser, uniqueName("Аня"));
  await owner.page.getByRole("button", { name: "Получить ссылку для друзей" }).click();
  const link = owner.page.getByRole("textbox", { name: "Ссылка-приглашение" });
  await expect(link).toHaveValue(/\/f\/[A-Za-z0-9_-]{24}$/);
  const inviteUrl = await link.inputValue();

  // Владелец по своей ссылке отвечать не может
  await owner.page.goto(inviteUrl);
  await expect(owner.page.getByRole("heading", { name: "Это твоя ссылка" })).toBeVisible();

  const friendContexts = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(inviteUrl);
    await expect(page.getByText("просит")).toBeVisible();
    await answerFriendForm(page);
    await expect(page.getByRole("heading", { name: "Спасибо! А какой тип у тебя?" })).toBeVisible();
    friendContexts.push({ context, page });
  }

  // Второй ответ с того же браузера не принимается
  const first = friendContexts[0]!;
  await first.page.goto(inviteUrl);
  await answerFriendForm(first.page);
  // Next.js держит на странице свой пустой role="alert" для объявления переходов, поэтому ищем по тексту
  await expect(first.page.getByRole("alert").filter({ hasText: "уже ответили" })).toBeVisible();

  await owner.page.goBack();
  await owner.page.reload();
  await expect(owner.page.getByText("Ответили 3 друга")).toBeVisible();
  await expect(owner.page.locator(".compare")).toHaveCount(5);
  await expect(owner.page.getByText("Друзья", { exact: true }).first()).toBeVisible();

  for (const { context } of friendContexts) await context.close();
  await owner.context.close();
});
