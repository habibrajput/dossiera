import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBackendRequestHeaders } from '@/lib/api/server';

const headersMock = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ headers: headersMock }));

describe('getBackendRequestHeaders', () => {
  beforeEach(() => {
    headersMock.mockReset();
  });

  it('forwards the incoming session cookie to the backend', async () => {
    headersMock.mockResolvedValue(new Headers({ cookie: 'resume_matcher_session=token' }));

    await expect(getBackendRequestHeaders()).resolves.toEqual({
      cookie: 'resume_matcher_session=token',
    });
  });

  it('returns no credentials when the request has no cookie', async () => {
    headersMock.mockResolvedValue(new Headers());

    await expect(getBackendRequestHeaders()).resolves.toEqual({});
  });
});
