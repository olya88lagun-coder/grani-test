import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1024, 1440]) {
  test(`redesign chrome fits ${width}px and keeps keyboard controls`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [name, path, footerColor] of [
      ["home", "/", "rgb(248, 241, 223)"],
      ["articles", "/articles", "rgb(238, 242, 228)"],
      ["pair", "/together", "rgb(255, 252, 250)"],
    ] as const) {
      await page.goto(path);
      const header = page.locator(".public-header");
      const footer = page.getByRole("contentinfo");
      await expect(header).toBeVisible();
      await expect(footer).toHaveCSS("background-color", footerColor);
      await expect(footer.getByRole("link")).toHaveCount(11);
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
      await expect(banner).toHaveCSS("background-color", name === "pair" ? "rgb(255, 252, 250)" : "rgb(245, 241, 228)");
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
  await expect(page.locator(".public-header")).toHaveCSS("background-color", "rgb(10, 31, 23)");
  await expect(page.locator(".footer")).toHaveCSS("background-color", "rgb(10, 31, 23)");
  expect(await page.locator("#pair-night").evaluate((element) => getComputedStyle(element).getPropertyValue("--gold").trim().toUpperCase())).toBe("#E3B3A0");
  expect(await page.locator("#pair-night").evaluate((element) => getComputedStyle(element).getPropertyValue("--garnet").trim().toUpperCase())).toBe("#B13A5C");
});

test("pair chrome uses rose gold when it is outside the page palette wrapper", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({ json: { signedIn: true } }));
  await page.goto("/together");
  await expect(page.locator(".public-header").getByRole("link", { name: "Мой профиль", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Настройки cookie" }).click();
  await expect(page.getByRole("dialog", { name: "Cookie" })).toBeVisible();
  await page.evaluate(() => {
    for (const element of document.querySelectorAll(".public-header, .footer, .cookie-banner")) element.setAttribute("data-band", "night");
  });
  for (const selector of [".public-header", ".footer", ".cookie-banner"]) {
    const element = page.locator(selector);
    await expect(element).toHaveCSS("background-color", "rgb(10, 31, 23)");
    expect(await element.evaluate((node) => getComputedStyle(node).getPropertyValue("--gold").trim().toUpperCase())).toBe("#E3B3A0");
    expect(await element.evaluate((node) => getComputedStyle(node).getPropertyValue("--garnet").trim().toUpperCase())).toBe("#B13A5C");
  }
});
