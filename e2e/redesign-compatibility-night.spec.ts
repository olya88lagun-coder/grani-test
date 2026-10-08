import { expect, test } from '@playwright/test';

for (const width of [320, 375, 390, 1024, 1440]) {
  test('compatibility: production layout and contracts at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/compatibility');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Тест на совместимость пары');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/compatibility$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await page.evaluate(() => document.fonts.ready);

    const hero = page.locator('main article > section').first();
    await expect(hero).toHaveAttribute('data-band', 'night');
    await expect(hero.locator('[data-gem-dir]')).toHaveCount(2);
    await expect(hero).toContainText('78%');
    await expect(hero).toContainText('пример · совместимость');
    await expect(hero.getByRole('link', { name: 'Пройти тест' })).toHaveAttribute('href', '/test');
    await expect(hero.getByRole('link', { name: 'Уже прошли — позвать партнёра' })).toHaveAttribute('href', '/me?to=pairs');
    await expect(page.locator('.steps li')).toHaveCount(4);
    for (const panel of await page.locator('.steps li, .formula li, .card').all()) await expect(panel).toHaveCSS('box-shadow', 'none');
    const venn = page.locator('.formula__icon--venn circle');
    await expect(venn.last()).toHaveCSS('fill', 'none');
    await expect(venn.last()).toHaveCSS('stroke', await venn.first().evaluate(node => getComputedStyle(node).stroke));
    await expect(venn.last()).not.toHaveCSS('stroke', 'none');
    await expect(page.locator('.steps li').nth(2)).toHaveText('Партнёр проходит тест и соглашается показать результат вам — без согласия пара не создаётся.');
    await expect(page.locator('[aria-labelledby="pair-report-inside"]')).toHaveAttribute('data-band', 'night');
    await expect(page.locator('[aria-labelledby="pair-price-title"]')).toContainText('399 ₽');
    await expect(page.locator('.public-header')).toHaveCSS('background-color', 'rgb(10, 31, 23)');

    for (const gem of await page.locator('[data-gem-dir]').all()) {
      await gem.scrollIntoViewIfNeeded();
      await expect(gem).toHaveAttribute('data-loaded', 'true');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // Подвал ночной на всех страницах
    await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', 'rgb(10, 31, 23)');
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
    await page.screenshot({ path: testInfo.outputPath('compatibility-' + width + '.png'), fullPage: true, animations: 'disabled', scale: 'css' });
    await page.screenshot({ path: testInfo.outputPath('compatibility-' + width + '-viewport.png'), animations: 'disabled', scale: 'css' });
    expect(errors).toEqual([]);
  });
}
