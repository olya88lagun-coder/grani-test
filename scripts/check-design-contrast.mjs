import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function contrastRatio(first, second) {
  function luminance(hex) {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Expected opaque #RRGGBB: ${hex}`);
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function tokens(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return {};
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

export function auditDesignContrast(css) {
  const base = tokens(css, ':root');
  const night = tokens(css, '[data-band="night"]');
  const palettes = [
    ['greenhouse', base, false],
    ['friends', { ...base, ...tokens(css, '[data-palette="friends"]') }, false],
    ['pair', { ...base, ...tokens(css, '[data-palette="pair"]') }, false],
    ['night', { ...base, ...night }, true],
    ['pair-night', { ...base, ...night, ...tokens(css, '[data-palette="pair"][data-band="night"]') }, true],
  ];
  const checks = [];
  const failures = [];
  if (!night['--bg']) failures.push('Missing night tokens');
  function check(palette, values, foreground, background, minimum) {
    const ratio = contrastRatio(values[foreground], values[background]);
    const label = `${palette}: ${foreground} on ${background}`;
    checks.push({ label, ratio, minimum });
    if (ratio < minimum) failures.push(`${label}: ${ratio.toFixed(2)} < ${minimum}`);
  }
  for (const [name, values, dark] of palettes) {
    for (const background of ['--bg', '--surface', '--surface-2', '--surface-3', '--surface-4']) {
      check(name, values, '--ink', background, 7);
      check(name, values, '--accent', background, 7);
      if (dark && night['--bg']) {
        check(name, values, '--ink-soft', background, 4.5);
        check(name, values, '--gold', background, 4.5);
        check(name, values, '--danger', background, 4.5);
      }
    }
    check(name, values, '--ink-soft', '--bg', 4.5);
    check(name, values, '--accent-ink', '--accent', 7);
    check(name, values, '--accent-ink', '--accent-hover', 7);
  }
  for (const background of ['--page-start', '--page-end', '--home-page-end', '--page-panel']) {
    check('chrome', base, '--ink', background, 7);
    check('chrome', base, '--accent', background, 7);
    check('chrome', base, '--ink-soft', background, 4.5);
  }
  return { checks, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = readFileSync(new URL('../apps/web/src/app/globals.css', import.meta.url), 'utf8');
  const result = auditDesignContrast(css);
  console.log(`${result.checks.length} contrast checks; ${result.failures.length} failures`);
  for (const check of result.checks) console.log(`${check.label}: ${check.ratio.toFixed(2)}:1 (>= ${check.minimum})`);
  if (result.failures.length) {
    console.error(result.failures.join('\n'));
    process.exitCode = 1;
  }
}
