import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const repo = resolve(dir, '../../..');
const require = createRequire(resolve(repo, 'package.json'));
const webRequire = createRequire(resolve(repo, 'apps/web/package.json'));
const { build } = require(resolve(repo, 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js'));
const out = resolve(repo, 'docs/together/deliverables');
await mkdir(out, { recursive: true });
await build({ absWorkingDir: repo, entryPoints: [resolve(dir, 'landing-preview.tsx')], bundle: true,
  outfile: resolve(dir, 'landing-preview.cjs'), platform: 'node', format: 'cjs', jsx: 'automatic',
  tsconfig: resolve(repo, 'apps/web/tsconfig.json'),
  alias: { '@grani/core': resolve(repo, 'packages/core/src/index.ts'),
    '@grani/content/together': resolve(repo, 'packages/content/src/together/catalog.ts'),
    '@grani/content/together-season': resolve(repo, 'packages/content/src/together/season.ts'),
    '@': resolve(repo, 'apps/web/src'),
    zod: resolve(repo, 'node_modules/.pnpm/zod@4.6.5/node_modules/zod') },
  external: ['/home/*'],
  plugins: [{ name: 'next-image-interop', setup(b) {
    b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'next-image', namespace: 'preview-interop' }));
    b.onLoad({ filter: /.*/, namespace: 'preview-interop' }, () => ({ contents: 'export { Image as default } from "next/dist/client/image-component";', loader: 'js' }));
  } }, { name: 'installed-runtime', setup(b) { b.onResolve({ filter: /^(react(?:\/|$)|react-dom(?:\/|$)|next\/)/ }, a => ({ path: webRequire.resolve(a.path), external: true })); } },
    { name: 'scoped-styles', setup(b) { b.onLoad({ filter: /\.module\.css$/ }, async a => ({ contents: await readFile(a.path, 'utf8'), loader: 'local-css' })); } }]
});
const { renderLanding, renderStats } = require(resolve(dir, 'landing-preview.cjs'));
let fonts = '';
for (const [family, file, weight] of [
  ['LandingDisplay', 'cormorant-garamond-cyrillic-300-normal.woff', 300],
  ['LandingDisplay', 'cormorant-garamond-latin-300-normal.woff', 300],
  ['LandingBody', 'golos-text-cyrillic-400-normal.woff', 400],
  ['LandingBody', 'golos-text-latin-400-normal.woff', 400],
  ['LandingBody', 'golos-text-cyrillic-600-normal.woff', 600],
  ['LandingBody', 'golos-text-latin-600-normal.woff', 600]]) {
  const buffer = await readFile(resolve(repo, 'apps/web/assets/fonts', file));
  fonts += `@font-face{font-family:${family};src:url(data:font/woff;base64,${buffer.toString('base64')});font-weight:${weight};${file.includes('cyrillic') ? 'unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;' : ''}font-display:swap;}`;
}
const css = await readFile(resolve(dir, 'landing-preview.css'), 'utf8');
const shell = body => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Грани. Вдвоём — проверка компонентов v2</title><style>${fonts}${css}:root{--font-cormorant:LandingDisplay;--font-golos:LandingBody}</style></head><body>${body}</body></html>`;
let landing = shell(renderLanding());
for (const file of ['hero-still-life-v3.webp', 'hero-still-life-mobile-v3.webp']) {
  const buffer = await readFile(resolve(repo, 'apps/web/public/together', file));
  landing = landing.replaceAll(`/together/${file}`, `data:image/webp;base64,${buffer.toString('base64')}`);
}
await writeFile(resolve(out, 'grani-together-landing-v2.html'), landing);
for (const [name, stats] of Object.entries({ zero: { days: 0, conversations: 0, dates: 0 }, populated: { days: 21, conversations: 14, dates: 2 }, firstDay: { days: 0, conversations: 1, dates: 0 }, quiet: { days: 3, conversations: 0, dates: 0 } })) {
  await writeFile(resolve(out, `together-stats-${name}.html`), shell(renderStats(stats)));
}
console.log(JSON.stringify({ status: 'built', sources: 'actual TogetherLanding, TogetherStats, SiteHeader, next/image; static rendering only', html: resolve(out, 'grani-together-landing-v2.html') }));
