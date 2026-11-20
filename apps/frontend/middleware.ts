/**
 * Route guard for the password-protected app.
 *
 * The backend owns authentication and is the only place that can validate the
 * signed session cookie. This middleware asks /auth/session on every page
 * navigation and redirects to /login when the visitor is not signed in.
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'rm_session';

function sessionEndpoint(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  const absolute = /^https?:\/\//.test(configured);
  const origin = absolute
    ? configured
    : (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8000').trim();
  return `${origin.replace(/\/+$/, '')}/api/v1/auth/session`;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target !== '/') {
    loginUrl.searchParams.set('next', target);
  }
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  try {
    const response = await fetch(sessionEndpoint(), {
      headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return redirectToLogin(request);
    }
    const session = (await response.json()) as { authenticated?: boolean };
    if (session.authenticated === true) {
      return NextResponse.next();
    }
  } catch (error) {
    // Fail closed: an unreachable backend must not expose protected pages.
    console.error('Login check failed:', error);
  }
  return redirectToLogin(request);
}

export const config = {
  // API routes are protected by the backend itself; exclude them, Next internals
  // and static files. Print routes stay guarded (PDFs carry their own cookie).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).*)'],
};
