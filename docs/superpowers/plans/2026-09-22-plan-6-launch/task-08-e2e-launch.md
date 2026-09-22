# Задача 8 — Сквозные сценарии, PR, выкладка, ручная проверка

**Files:**
- Create: `e2e/launch.spec.ts`
- Modify: `e2e/helpers.ts` (закрыть cookie-баннер в общих шагах)
- Modify: `docs/superpowers/plans/2026-09-22-plan-6-launch/00-overview.md` (статус)
- Modify: `docs/superpowers/plans/00-roadmap.md` (статус плана 6)

## Зачем

Спецификация 7: сквозные тесты и ручная проверка перед запуском — реальная оплата, чек в «Мой налог», вход через Telegram и VK на телефоне, отображение карточек.

## Шаги

- [ ] **Шаг 1. Баннер в старых сценариях.** Cookie-баннер фиксирован внизу и может закрывать кнопки теста на Pixel 7. В `helpers.ts` добавить `dismissCookies(page)`: при наличии диалога `Cookie` нажимает «Только необходимые». Вызвать её в начале общих шагов (`login`, прохождение теста). Проще — `page.addInitScript(() => localStorage.setItem("grani-cookie-consent", "necessary"))` в фикстуре для всех сценариев, кроме сценария баннера.

- [ ] **Шаг 2. `e2e/launch.spec.ts`.**

```ts
import { expect, test } from "@playwright/test";
import { signedInWithResult, uniqueName } from "./helpers";

test("public pages are indexable and private ones are not", async ({ page, request }) => {
  await page.goto("/types/iskra");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Искра");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
  await page.getByRole("link", { name: /Пройти тест/ }).first().click();
  await expect(page).toHaveURL(/\/test$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap.match(/<loc>/g)).toHaveLength(38);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /result/");
});

test("cookie banner loads nothing until accepted and can be reopened", async ({ page }) => {
  const metrika: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("mc.yandex")) metrika.push(r.url());
  });
  await page.goto("/");
  const banner = page.getByRole("dialog", { name: "Cookie" });
  await banner.getByRole("button", { name: "Только необходимые" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(banner).toBeHidden();
  await page.getByRole("button", { name: "Настройки cookie" }).click();
  await expect(banner).toBeVisible();
  expect(metrika).toEqual([]);
});

test("a user deletes their data and the result disappears", async ({ browser }) => {
  const { context, page } = await signedInWithResult(browser, uniqueName("Удаляемая"));
  const resultUrl = page.url();
  await page.getByRole("link", { name: "Удалить мои данные" }).click();
  const remove = page.getByRole("button", { name: "Удалить навсегда" });
  await expect(remove).toBeDisabled();
  await page.getByLabel(/без возможности восстановления/).check();
  await remove.click();
  await expect(page.getByText("Данные удалены")).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login/);
  const response = await page.goto(resultUrl);
  expect(response?.status()).toBe(404);
  await context.close();
});

test("documents are linked from every page footer", async ({ page }) => {
  for (const path of ["/", "/types", "/compatibility", "/articles"]) {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    for (const name of ["Контакты и услуги", "Оферта", "Политика обработки данных", "Согласие"]) {
      await expect(footer.getByRole("link", { name })).toBeVisible();
    }
  }
  await page.goto("/contacts");
  await expect(page.getByText(/ИНН \d{12}/)).toBeVisible();
});
```

`signedInWithResult` создаёт отдельный контекст браузера — в нём баннер нужно закрыть так же, как в шаге 1 (инициализирующий скрипт добавить в `signedInWithResult`). 38 адресов в sitemap — 32 из задачи 3 и 6 из задачи 4.

- [ ] **Шаг 3. Итоговые проверки.**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm typecheck
pnpm test:coverage
pnpm --filter @grani/web build
pnpm --filter @grani/worker build
pnpm test:e2e
```

Сквозные — с тремя процессами (`dev:db`, `dev:web`, `dev:worker`), как в плане 5. Ожидается: все старые сценарии (9) и 4 новых зелёные, покрытие ≥ 80% по всем группам, сборки без предупреждений. Поиск секретов по диффу:

```bash
git diff master...HEAD | grep -nEi "(token|secret|key|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}" || echo "clean"
```

- [ ] **Шаг 4. Статус и PR.** В `00-overview.md` — строка статуса (тесты, покрытие, что проверено вживую). В `00-roadmap.md` — отметка о плане 6. Показать пользователю итог и скриншоты (`/types`, `/types/iskra`, `/compatibility`, статья, баннер, `/me/delete` на 375px) и спросить разрешение на push и PR. После «да»:

```bash
git push -u origin feat/launch
gh pr create --base master --title "План 6: запуск — документы, удаление данных, страницы под поиск, Метрика, выкладка" --body-file <scratchpad>/pr-6.md
```

Тело PR:
- кратко по задачам 1–8;
- как проверить локально;
- результаты проверок;
- что делает `deploy.yml` после мержа;
- что осталось пользователю: предварительные действия 4–10 из обзора.

Мерж — только после зелёного CI и «да» пользователя.

- [ ] **Шаг 5. Первая выкладка.** Перед мержем сервер должен быть готов (задача 7, шаг 7): база, `.env` с секретами, доступ к GHCR, блок Caddy, GitHub Secrets для `deploy.yml`. После мержа:
  1. `gh run watch` для `images` и `deploy`;
  2. если `deploy` упал, прочитать лог шага и исправить отдельным PR. Секреты в лог не выводить;
  3. задача 7, шаг 8 — проверка `X-Forwarded-For`;
  4. `docker stats --no-stream` на сервере — память `grani-web-1` и `grani-worker-1` в пределах лимитов, трекер и wishlist отвечают.

- [ ] **Шаг 6. Ручная проверка на телефоне — вместе с пользователем.** Список для пользователя, каждый пункт отмечается ответом:
  1. Первый экран → тест → вход через **Telegram** (виджет открывается, бот просит разрешение на сообщения) → результат, карточка «мой тип» скачивается и выглядит как в превью.
  2. То же через **VK ID** в другом браузере; в сообществе ВК «Разрешить сообщения» → в логе воркера `vk` включён.
  3. Друг: ссылка открыта в другом браузере, 3 ответа → уведомление «Ответил ещё один друг» пришло в Telegram, а на третьем ответе появилось сравнение.
  4. Пара: приглашение, согласие партнёра, страница пары у обоих.
  5. **Тестовый магазин ЮKassa** (ключи тестового магазина в `.env`): оплата тестовой картой из документации ЮKassa (успешная оплата, например `5555 5555 5555 4477`) → «Готовим разбор» → разбор. Уведомление ЮKassa принято (`docker logs grani-web-1 | grep yookassa` без ошибок). Разбор сделал ИИ: в базе `select source from reports order by created_at desc limit 1` → `ai`. Пришло уведомление «Готово».
  6. **Боевой магазин**: ключи заменены, одна настоящая покупка полного разбора за 299 ₽ → чек в «Мой налог» появился. Возврат этой покупки — через личный кабинет ЮKassa, чтобы проверить и этот путь.
  7. Удаление данных тестового аккаунта с телефона.
  8. Cookie-баннер: «Принять» → в Метрике за сегодня виден визит и цели `test_start`/`test_finish`.
  9. Яндекс.Вебмастер: права подтверждены, `sitemap.xml` добавлен, ошибок индексирования нет. Отправить на переобход главную и `/types`.
  10. Уведомление в Роскомнадзор подано (предварительное действие 9).

  Что не прошло — отдельной задачей с исправлением. Сайт открыт для поиска только после пунктов 5, 6 и 10. До этого можно временно вернуть `noindex`, если пользователь хочет подождать с индексацией.

- [ ] **Шаг 7. Итог.** Обновить статус в `00-overview.md` (что проверено на телефоне) отдельным коммитом в `master` через короткий PR. Сообщить пользователю, что сайт запущен, и перечислить, что смотреть в первый месяц: воронка из раздела 8 спецификации по целям Метрики.
