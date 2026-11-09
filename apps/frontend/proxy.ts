import { NextRequest, NextResponse } from 'next/server';

const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:8000').replace(
  /(?<!\/)\/+$/,
  ''
);

type AuthState = {
  authenticated: boolean;
  authRequired: boolean;
};

async function getAuthState(request: NextRequest): Promise<AuthState | null> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/v1/auth/session`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthState;
  } catch {
    // Fail closed: the backend still protects every API if the guard cannot reach it.
    return null;
  }
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const state = await getAuthState(request);
  if (state && (!state.authRequired || state.authenticated)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}${request.nextUrl.hash}`
  );
  const response = NextResponse.redirect(loginUrl);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!api/|_next/static/|_next/image/|favicon.ico|logo.svg).*)'],
};
