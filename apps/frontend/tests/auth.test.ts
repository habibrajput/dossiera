import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '@/lib/auth';

describe('safeReturnTo', () => {
  it.each([
    [undefined, '/dashboard'],
    ['', '/dashboard'],
    ['https://example.com/steal', '/dashboard'],
    ['//example.com/steal', '/dashboard'],
    ['/\\example.com/steal', '/dashboard'],
    ['/login?next=/dashboard', '/dashboard'],
    ['not-a-path', '/dashboard'],
  ])('rejects unsafe destination %s', (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it('preserves a local path, query, and hash', () => {
    expect(safeReturnTo('/settings?tab=ai#provider')).toBe('/settings?tab=ai#provider');
  });
});
