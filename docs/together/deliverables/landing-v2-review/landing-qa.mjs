import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/dev/grani-test/package.json');
const { chromium } = require('@playwright/test');
const dir = 'C:/Users/olya8/Documents/Codex/2026-10-07/referenced-chatgpt-conversation-this-is-an/outputs';
const preview = 'C:/dev/grani-test/docs/together/deliverables/';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
const luminance = hex => hex.match(/\w\w/g).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4).reduce((sum,x,i) => sum+x*[.2126,.7152,.0722][i],0);
const contrast = (foreground,background) => {const a=luminance(foreground), b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
const colors=[];
for(const foreground of ['625158','7d4e3e','4A2230']) for(const background of ['fffaf5','f4ece3','f5e7db','e9d4c7','F6E8E1','edddd2']) colors.push({foreground,background,ratio:contrast(foreground,background)});
colors.push({foreground:'FFFCFA',background:'4A2230',ratio:contrast('FFFCFA','4A2230')});
for (const [width, height] of [[320, 720], [390, 844], [768, 1024], [1024, 900], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width, height }, locale: 'ru-RU' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(preview + 'grani-together-landing-v2.html').href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/together-${width}.png`, fullPage: true });
  await page.screenshot({ path: `${dir}/together-hero-${width}.png` });
  const layout = await page.evaluate(() => {
    const main = document.querySelector('main');
    const cta = main.querySelector('a');
    const box = cta.getBoundingClientRect();
    const headings = [...main.querySelectorAll('h1,h2,h3')].map(x => ({ level: Number(x.tagName[1]), text: x.textContent }));
    let previous = 0;
    const skips = headings.filter(x => { const skip = x.level > previous + 1; previous = x.level; return skip; });
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: innerWidth, ctaBottom: box.bottom, ctaInFirstScreen: box.bottom <= innerHeight,
      priceInFirstScreen: cta.nextElementSibling.getBoundingClientRect().bottom <= innerHeight,
      h1Count: main.querySelectorAll('h1').length, headingSkips: skips,
      enterLinks: [...main.querySelectorAll('a[href*="/api/together/enter"]')].map(x => x.getAttribute('href')),
      imageLoaded: [...main.querySelectorAll('img')].every(x => x.complete && x.naturalWidth > 0),
      selectedImage: main.querySelector('img').naturalWidth,
      sampleCount: [...main.querySelectorAll('article')].filter(x => x.textContent.includes('Пример')).length };
  });
  const faq = page.getByText('Нужно ли проходить тест личности?', { exact: true });
  await faq.focus();
  await page.keyboard.press('Enter');
  const faqWorks = await faq.evaluate(x => x.closest('details').open);
  const focusVisible = await faq.evaluate(x => { const s = getComputedStyle(x); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.locator('main a').first().evaluate(x => getComputedStyle(x).transitionDuration === '0s');
  checks.push({ width, height, ...layout, faqWorks, focusVisible, reducedMotion, errors });
  await page.close();
}
const stats = [];
for (const name of ['zero', 'populated', 'firstDay', 'quiet']) {
  const page = await browser.newPage({ viewport: { width: 320, height: 600 } });
  await page.goto(pathToFileURL(preview + `together-stats-${name}.html`).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/together-stats-${name}.png`, fullPage: true });
  stats.push({ name, text: await page.locator('main').innerText(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  await page.close();
}
await browser.close();
const report = { scope: 'Actual components rendered statically. Production auth, database, payments, Next.js request handling not exercised.', colors, minimumTokenContrast:Math.min(...colors.map(x=>x.ratio)), checks, stats };
await writeFile(dir + '/together-qa.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (colors.some(x=>x.ratio<4.5) || checks.some(x => x.scrollWidth > x.clientWidth || !x.ctaInFirstScreen || !x.priceInFirstScreen || x.h1Count !== 1 || x.headingSkips.length || !x.imageLoaded || !x.faqWorks || !x.focusVisible || !x.reducedMotion || x.errors.length) || stats.some(x => x.overflow)) process.exitCode = 1;
