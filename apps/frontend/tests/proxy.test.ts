import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from '@/proxy';

function authResponse(authenticated: boolean, authRequired = true): Response {
  return new Response(JSON.stringify({ authenticated, authRequired }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('authentication route guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects an unauthenticated page request and preserves its destination', async () => {
    fetchMock.mockResolvedValue(authResponse(false));
    const request = new NextRequest('http://localhost:3000/settings?tab=ai', {
      headers: { cookie: 'resume_matcher_session=expired' },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fsettings%3Ftab%3Dai'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/v1/auth/session',
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: 'resume_matcher_session=expired' }),
      })
    );
  });

  it('allows a valid session', async () => {
    fetchMock.mockResolvedValue(authResponse(true));
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await proxy(request);

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows every page when authentication is not configured', async () => {
    fetchMock.mockResolvedValue(authResponse(false, false));
    const request = new NextRequest('http://localhost:3000/tracker');

    const response = await proxy(request);

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('fails closed if the session service is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('backend unavailable'));
    const request = new NextRequest('http://localhost:3000/builder');

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });

  it('does not require a backend call to render the login page', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/login'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
