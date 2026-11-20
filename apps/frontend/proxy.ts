/**
 * Route guard for the password-protected app.
 *
 * The backend owns authentication and is the only place that can validate the
 * signed session cookie. This proxy asks /auth/session on every page
 * navigation and redirects to / (the sign-in page) when the visitor is not
 * signed in.
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

function redirectToSignIn(request: NextRequest): NextResponse {
  const signInUrl = new URL('/', request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target !== '/') {
    signInUrl.searchParams.set('next', target);
  }
  return NextResponse.redirect(signInUrl);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  try {
    const response = await fetch(sessionEndpoint(), {
      headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return redirectToSignIn(request);
    }
    const session = (await response.json()) as { authenticated?: boolean };
    if (session.authenticated === true) {
      return NextResponse.next();
    }
  } catch (error) {
    // Fail closed: an unreachable backend must not expose protected pages.
    console.error('Login check failed:', error);
  }
  return redirectToSignIn(request);
}

export const config = {
  // API routes are protected by the backend itself; exclude them, Next internals,
  // static files and the public sign-in page. `.+` leaves `/` unguarded so it can
  // render the sign-in form. Print routes stay guarded (PDFs carry their cookie).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).+)'],
};
