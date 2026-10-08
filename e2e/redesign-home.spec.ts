import { expect, test } from "@playwright/test";
import { contrastRatio } from "../scripts/check-design-contrast.mjs";

for (const width of [320, 390, 1024, 1440]) {
  test(`home redesign keeps night/light bands, contrast and layout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page).toHaveTitle("Грани — тест личности по модели Big Five");
    const hero = page.locator(".home-hero");
    await expect(hero).toHaveAttribute("data-band", "night");
    await expect(page.locator(".home-types")).toHaveAttribute("data-band", "night");
    for (const selector of [".home-result", ".home-articles"]) await expect(page.locator(selector)).not.toHaveAttribute("data-band", "night");
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText("Тест личности «Грани»Узнай себя глубже");
    const actions = hero.locator(".home-hero__actions");
    await expect(actions.getByRole("link", { name: "Пройти тест" })).toHaveAttribute("href", "/test");
    await expect(actions.getByRole("link", { name: "о тесте Big Five" })).toHaveAttribute("href", "/big-five-test");
    await expect(actions.locator(".button")).toHaveCount(1);
    await expect(page.locator(".home-type-card__art [data-gem-dir]")).toHaveCount(5);
    await expect(page.locator(".home-type-card__art img")).toHaveCount(5);
    await expect(page.locator(".home-article-card img")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const gemBox = await hero.locator(".home-crystal > div > img").boundingBox();
    const sceneBox = await hero.locator(".home-crystal").boundingBox();
    expect(gemBox!.width).toBeGreaterThan(150);
    expect(gemBox!.width / sceneBox!.width).toBeGreaterThan(.6);
    expect(gemBox!.width / sceneBox!.width).toBeLessThan(.8);
    for (const card of await page.locator(".home-type-card").all()) {
      const description = await card.locator("p").boundingBox();
      const action = await card.getByRole("link").boundingBox();
      expect(action!.y).toBeGreaterThanOrEqual(description!.y + description!.height - 1);
      expect(action!.width).toBeGreaterThanOrEqual(44);
      await expect(card).toHaveCSS("box-shadow", "none");
    }
    for (const selector of [".home-result-card", ".home-note-card", ".home-person-card", ".home-article-card"]) {
      for (const element of await page.locator(selector).all()) await expect(element).toHaveCSS("box-shadow", "none");
    }
    for (const card of await page.locator(".home-person-card").all()) {
      const bounds = await card.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node.querySelector("h3")!);
        return { card: node.getBoundingClientRect().toJSON(), text: range.getBoundingClientRect().toJSON(), gem: node.querySelector("[data-gem-dir]")!.getBoundingClientRect().toJSON() };
      });
      expect(bounds.text.left).toBeGreaterThanOrEqual(bounds.card.left);
      expect(bounds.text.right).toBeLessThanOrEqual(bounds.card.right);
      expect(bounds.gem.left).toBeGreaterThanOrEqual(bounds.card.left);
      expect(bounds.gem.right).toBeLessThanOrEqual(bounds.card.right);
      const outline = card.locator("[data-gem-dir] > span > svg > polygon").last();
      await expect(outline).toHaveCSS("stroke", await card.evaluate((node) => getComputedStyle(node).color));
      await expect(card.locator("[data-gem-dir] > span > svg")).toHaveCSS("filter", "none");
    }
    const samples = await page.locator(".home-kicker, .home-hero h1, .home-lead, .home-time, .home-crystal__label, .home-section__copy h2, .home-section__copy > p, .home-type-card h3, .home-type-card p, .home-type-card > a").evaluateAll((elements) => {
      // CSS color-mix may compute to oklab(). Let the browser convert to sRGB.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      function channels(color: string): number[] {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      }
      function background(node: Element | null): number[] {
        if (!node) return [255, 255, 255];
        const color = channels(getComputedStyle(node).backgroundColor);
        const image = getComputedStyle(node).backgroundImage;
        if (color[3] === 0 && image.includes("linear-gradient")) {
          const stops = [...image.matchAll(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g)].map(match => channels(match[0]));
          const opaque = stops.filter(stop => stop[3] === 255);
          if (opaque.length) {
            // Upper bound: brightest base channels, then every translucent highlight at its maximum.
            const bound = [0, 1, 2].map(i => Math.max(...opaque.map(stop => stop[i]!)));
            for (const stop of stops.filter(stop => stop[3]! > 0 && stop[3]! < 255)) {
              const alpha = stop[3]! / 255;
              for (let i = 0; i < 3; i++) bound[i] = Math.max(bound[i]!, Math.round(stop[i]! * alpha + bound[i]! * (1 - alpha)));
            }
            return bound;
          }
        }
        const alpha = color[3]! / 255;
        if (alpha === 1) return color.slice(0, 3);
        const parent = background(node.parentElement);
        return parent.map((channel, i) => Math.round(color[i]! * alpha + channel * (1 - alpha)));
      }
      function hex(color: number[]): string {
        return "#" + color.slice(0, 3).map((channel) => channel.toString(16).padStart(2, "0")).join("");
      }
      return elements.map((element) => ({ text: element.textContent, foreground: hex(channels(getComputedStyle(element).color)), background: hex(background(element)), fontSize: parseFloat(getComputedStyle(element).fontSize) }));
    });
    for (const sample of samples) expect(contrastRatio(sample.foreground, sample.background), `${sample.text}: foreground/background contrast`).toBeGreaterThanOrEqual(sample.fontSize >= 24 ? 3 : 4.5);
    await actions.getByRole("link", { name: "о тесте Big Five" }).focus();
    await expect(actions.getByRole("link", { name: "о тесте Big Five" })).toHaveCSS("outline-style", "solid");
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (const [name, selector] of [["hero", ".home-hero"], ["types", ".home-types"], ["result", ".home-result"], ["articles", ".home-articles"], ["pair", ".home-pair"], ["header", ".public-header"], ["footer", ".footer"]]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      for (const image of await section.locator("img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
      }
      await section.screenshot({ path: testInfo.outputPath(`home-stage2-${name}-${width}.png`), scale: "css", style: "nextjs-portal { display: none; }" });
    }
    await page.screenshot({ path: testInfo.outputPath(`home-stage2-full-${width}.png`), fullPage: true, scale: "css", style: "nextjs-portal { display: none; }" });
    expect(errors).toEqual([]);
  });
}

test("home sheen uses eight seconds and stops for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const sheen = page.locator(".home-crystal [clip-path] rect");
  await expect(sheen).toHaveCSS("animation-duration", "8s");
  const gem = page.locator(".home-crystal > div");
  await expect(gem).toHaveCSS("animation-duration", "9s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sheen).toHaveCSS("animation-name", "none");
  await expect(gem).toHaveCSS("animation-name", "none");
  await expect(sheen).toHaveCSS("opacity", "0");
});

test("home primary and secondary actions work from the keyboard", async ({ page }) => {
  await page.goto("/");
  const actions = page.locator(".home-hero__actions");
  await actions.getByRole("link", { name: "Пройти тест" }).focus();
  await actions.getByRole("link", { name: "Пройти тест" }).press("Enter");
  await expect(page).toHaveURL(/\/test$/);
  await page.goto("/");
  await actions.getByRole("link", { name: "о тесте Big Five" }).focus();
  await actions.getByRole("link", { name: "о тесте Big Five" }).press("Enter");
  await expect(page).toHaveURL(/\/big-five-test$/);
});
