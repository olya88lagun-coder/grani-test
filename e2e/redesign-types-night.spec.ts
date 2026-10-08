import { expect, test } from '@playwright/test';

for (const width of [320, 375, 390, 1024, 1440]) {
  test('types: production layout and contracts at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/types');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('16 типов личности');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/types$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await page.evaluate(() => document.fonts.ready);

    const cards = page.locator('main ul a[data-band="night"]');
    await expect(cards).toHaveCount(16);
    await expect(cards.locator('[data-gem-dir]')).toHaveCount(16);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('href', /^\/types\/[a-z-]+$/);
      await expect(card.locator('h3')).not.toHaveText('');
      await expect(card.locator('h3 + span')).toHaveCSS('color', await card.locator('p').evaluate(node => getComputedStyle(node).color));
    }
    for (let family = 1; family <= 4; family++) {
      await page.locator('nav[aria-label="Семейства типов"] a').nth(family - 1).click();
      await expect(page.locator('#family-' + family)).toBeInViewport();
    }
    await expect(page.locator('.public-header')).toHaveCSS('background-color', 'rgb(10, 31, 23)');

    for (const gem of await page.locator('[data-gem-dir]').all()) {
      await gem.scrollIntoViewIfNeeded();
      await expect(gem).toHaveAttribute('data-loaded', 'true');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const footerColor = await page.locator('main').evaluate(node => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--chrome-bg)'; node.append(probe);
      const color = getComputedStyle(probe).color; probe.remove(); return color;
    });
    await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', footerColor);
    // Audit actual foregrounds against the closest opaque CSS background. All text areas are opaque.
    const failures = await page.locator('main').evaluate(main => {
      const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number);
      const luminance = (c: number[]) => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i]!, 0);
      const failures: string[] = [];
      for (const node of main.querySelectorAll('h1,h2,h3,p,li,a,span')) {
        if (!Array.from(node.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
        if (!node.getBoundingClientRect().width || node.closest('[aria-hidden="true"]')) continue;
        let parent: Element | null = node;
        let background: number[] = [];
        while (parent) {
          background = rgb(getComputedStyle(parent).backgroundColor);
          if (background[3] === undefined || background[3] >= .99) break;
          parent = parent.parentElement;
        }
        if (!background.length) continue;
        const foreground = rgb(getComputedStyle(node).color);
        const a = luminance(foreground), b = luminance(background);
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 4.5) failures.push(node.textContent!.trim().slice(0, 65) + ': ' + ratio.toFixed(2));
      }
      return failures;
    });
    expect(failures).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('types-' + width + '.png'), fullPage: true, animations: 'disabled', scale: 'css' });
    await page.screenshot({ path: testInfo.outputPath('types-' + width + '-viewport.png'), animations: 'disabled', scale: 'css' });
    expect(errors).toEqual([]);
  });
}
