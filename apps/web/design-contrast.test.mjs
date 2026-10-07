import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditDesignContrast, contrastRatio } from '../../scripts/check-design-contrast.mjs';

const css = readFileSync(new URL('./src/app/globals.css', import.meta.url), 'utf8');

describe('design token contrast', () => {
  it('uses the WCAG sRGB formula independent of foreground order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(contrastRatio('#123226', '#123226')).toBe(1);
    expect(() => contrastRatio('transparent', '#FFFFFF')).toThrow('opaque');
  });

  it('keeps actual light and night CSS tokens readable', () => {
    expect(auditDesignContrast(css).failures).toEqual([]);
  });

  it('catches unreadable footer and cookie backgrounds', () => {
    const result = auditDesignContrast(css.replace(/--page-start:\s*#[\da-f]{6}/i, '--page-start: #5E6660'));
    expect(result.failures.some((failure) => failure.startsWith('chrome: --ink-soft on --page-start'))).toBe(true);
  });

  it('rejects missing night tokens', () => {
    expect(auditDesignContrast(css.replaceAll('[data-band="night"]', '[data-band="removed"]')).failures).toContain('Missing night tokens');
  });

  it('catches secondary text disappearing into a night panel', () => {
    const result = auditDesignContrast(css.replace('--ink-soft: #A3B0A2', '--ink-soft: #123226'));
    expect(result.failures.some((failure) => failure.startsWith('night: --ink-soft'))).toBe(true);
  });
});
