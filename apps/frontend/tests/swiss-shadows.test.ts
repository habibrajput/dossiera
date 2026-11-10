import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/(default)/css/globals.css'),
  'utf8'
);
const shadows = Object.fromEntries(
  [...css.matchAll(/--shadow-sw-([a-z]+):\s*([^;]+);/g)].map(([, name, value]) => [
    name,
    value.trim(),
  ])
);
describe('soft shadow tokens', () => {
  it('defines the elevation roles', () => {
    expect(Object.keys(shadows).sort()).toEqual(['card', 'default', 'lg', 'nested', 'sm', 'xl']);
  });

  it('uses low-opacity, layered elevation rather than hard ink offsets', () => {
    expect(shadows.sm).toBe('0 1px 2px 0 rgb(0 0 0 / 0.05)');
    expect(shadows.default).toBe('0 2px 4px 0 rgb(0 0 0 / 0.05), 0 1px 2px 0 rgb(0 0 0 / 0.04)');
    expect(shadows.card).toBe('0 4px 12px -4px rgb(0 0 0 / 0.08)');
    expect(shadows.lg).toBe('0 8px 24px -6px rgb(0 0 0 / 0.1)');
    expect(shadows.xl).toBe('0 16px 40px -12px rgb(0 0 0 / 0.14)');
    expect(shadows.nested).toBe('0 1px 2px 0 rgb(0 0 0 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.06)');
  });
});
