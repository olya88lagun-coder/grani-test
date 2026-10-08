import { expect, test, type Locator } from "@playwright/test";

// Разрешаем var()/hex в браузере; значения палитры остаются только в globals.css.
async function tokenColor(element: Locator, token: string) {
  return element.evaluate((node, property) => {
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(node).getPropertyValue(property);
    node.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

for (const width of [320, 390, 1024, 1440]) {
  test(`redesign chrome fits ${width}px and keeps keyboard controls`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [name, path] of [
      ["home", "/"],
      ["articles", "/articles"],
      ["pair", "/together"],
    ] as const) {
      await page.goto(path);
      const header = page.locator(".public-header");
      const footer = page.getByRole("contentinfo");
      await expect(header).toBeVisible();
      // Подвал ночной на всех страницах, кроме «Тумана» (анкета друзей), которого здесь нет
      await expect(footer).toHaveAttribute("data-band", "night");
      await expect(footer).toHaveCSS("background-color", "rgb(10, 31, 23)");
      for (const [name, href] of [["Оферта", "/offer"], ["Политика обработки данных", "/privacy"], ["Мой результат", "/me"]]) {
        await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
      }
      expect(await footer.getByRole("link").evaluateAll((links) => links.every((link) => link.textContent?.trim() && link.getAttribute("href")?.startsWith("/")))).toBe(true);
      const consent = footer.getByRole("button", { name: "Настройки cookie" });
      await expect(consent).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await header.screenshot({ path: testInfo.outputPath(`${name}-header-${width}.png`), scale: "css", style: "nextjs-portal { display: none; }" });
      await footer.screenshot({ path: testInfo.outputPath(`${name}-footer-${width}.png`), scale: "css", style: "nextjs-portal { display: none; }" });
      await consent.focus();
      await consent.press("Enter");
      const banner = page.getByRole("dialog", { name: "Cookie" });
      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS("box-shadow", "none");
      await expect(banner).toHaveCSS("background-color", await tokenColor(page.locator("main"), name === "pair" ? "--bg" : "--page-start"));
      const box = await banner.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeLessThanOrEqual(868);
      await banner.screenshot({ path: testInfo.outputPath(`${name}-cookie-${width}.png`), scale: "css", style: "nextjs-portal { display: none; }" });
      await banner.getByRole("button", { name: "Только необходимые" }).focus();
      await page.keyboard.press("Enter");
      await expect(banner).toBeHidden();
      if (width <= 1100) {
        const summary = header.locator("summary");
        await summary.focus();
        await summary.press("Enter");
        const navigation = header.getByRole("navigation", { name: "Основная навигация" }).filter({ visible: true });
        await expect(navigation.getByRole("link", { name: "Совместимость", exact: true })).toBeVisible();
        await expect(navigation.locator("..")).toHaveCSS("box-shadow", "none");
        await expect(summary).toHaveCSS("outline-style", "solid");
        await page.screenshot({ path: testInfo.outputPath(`${name}-menu-${width}.png`), scale: "css", style: "nextjs-portal { display: none; }" });
        await page.keyboard.press("Escape");
        await expect(summary).toBeFocused();
        await expect(header.locator("details")).not.toHaveAttribute("open");
      }
    }
  });
}

test("night bands override chrome tones and pair gold inherits on whole sections", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { signedIn: true } }));
  await page.goto("/articles");
  await expect(page.locator(".public-header").getByRole("link", { name: "Мой профиль", exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.querySelector(".public-header")!.setAttribute("data-band", "night");
    document.querySelector(".footer")!.setAttribute("data-band", "night");
    const section = document.createElement("section");
    section.dataset.palette = "pair";
    section.innerHTML = '<section data-band="night" id="pair-night"></section>';
    document.querySelector("main")!.append(section);
  });
  const reference = page.locator("#pair-night");
  for (const selector of [".public-header", ".footer"]) {
    await expect(page.locator(selector)).toHaveCSS("background-color", await tokenColor(reference, "--bg"));
  }
  expect(await tokenColor(reference, "--gold")).not.toBe(await tokenColor(page.locator(".footer"), "--gold"));
  expect(await reference.evaluate((node) => getComputedStyle(node).getPropertyValue("--garnet").trim())).not.toBe("");
});

test("pair chrome uses rose gold when it is outside the page palette wrapper", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { signedIn: true } }));
  await page.goto("/together");
  await expect(page.locator(".public-header").getByRole("link", { name: "Мой профиль", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Настройки cookie" }).click();
  await expect(page.getByRole("dialog", { name: "Cookie" })).toBeVisible();
  await page.evaluate(() => {
    for (const element of document.querySelectorAll(".public-header, .footer, .cookie-banner")) element.setAttribute("data-band", "night");
    const reference = document.createElement("section");
    reference.dataset.band = "night";
    reference.id = "pair-night";
    document.querySelector("main")!.append(reference);
  });
  for (const selector of [".public-header", ".footer", ".cookie-banner"]) {
    const element = page.locator(selector);
    const reference = page.locator("#pair-night");
    await expect(element).toHaveCSS("background-color", await tokenColor(reference, "--bg"));
    for (const token of ["--gold", "--garnet"]) expect(await tokenColor(element, token)).toBe(await tokenColor(reference, token));
  }
});

test("page endpoint token updates the final page surface", async ({ page }) => {
  for (const [path, token] of [["/", "--home-page-end"], ["/articles", "--page-end"]]) {
    await page.goto(path);
    const main = page.locator("main");
    const before = await tokenColor(main, "--chrome-bg");
    // Другой существующий тон: проверяем связь, не фиксируем RGB палитры.
    const next = await tokenColor(main, "--surface-2");
    expect(next).not.toBe(before);
    await page.evaluate(({ token, next }) => document.documentElement.style.setProperty(token, next), { token, next });
    if (path === "/") await expect(page.locator(".home-articles")).toHaveCSS("background-color", next);
    else expect(await main.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(next);
    await page.evaluate((token) => document.documentElement.style.removeProperty(token), token);
  }
});

test("cookie keeps page tokens without the body has bridge", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { signedIn: true } }));
  for (const path of ["/", "/articles", "/together"]) {
    await page.goto(path);
    await expect(page.locator(".public-header").getByRole("link", { name: "Мой профиль", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Настройки cookie" }).click();
    const banner = page.getByRole("dialog", { name: "Cookie" });
    await expect(banner).toBeVisible();
    await page.evaluate(() => {
      // Прямой main исчезает из body: правила body:has(> main/класс) больше не совпадают.
      const wrapper = document.createElement("div");
      document.body.append(wrapper);
      for (const node of document.querySelectorAll("body > main, body > .footer, body > .cookie-banner")) wrapper.append(node);
    });
    const main = page.locator("main");
    await expect(banner).toHaveCSS("background-color", await tokenColor(main, path === "/together" ? "--bg" : "--page-start"));
  }
});
