import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../global.css');

describe('global.css Uniwind theme variants', () => {
  const css = readFileSync(cssPath, 'utf8');

  it('registers dark tokens with Uniwind variants instead of prefers-color-scheme', () => {
    expect(css).toMatch(/@variant\s+dark/);
    expect(css).toMatch(/@variant\s+light/);
    expect(css).not.toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
  });

  it('keeps the earthy canvas tokens for both schemes', () => {
    expect(css).toContain('--color-background: #f8f7f3');
    expect(css).toContain('--color-background: #1a1f16');
  });
});
