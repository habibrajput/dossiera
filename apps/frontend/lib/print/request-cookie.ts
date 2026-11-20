import { headers } from 'next/headers';

/**
 * Returns the incoming Cookie header so server-rendered print pages can pass
 * the login session to the protected backend API.
 *
 * `headers()` only works inside a Next.js request. These pages are also
 * rendered directly in component tests, where calling it throws. In that case
 * there is no session to forward, so return an empty string.
 */
export async function getRequestCookieHeader(): Promise<string> {
  try {
    return (await headers()).get('cookie') ?? '';
  } catch {
    return '';
  }
}
