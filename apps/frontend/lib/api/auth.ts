/**
 * Password-login API client.
 *
 * The cookie is set by the backend on the same origin the browser uses (the
 * Next.js proxy by default), so every call opts into credentials explicitly.
 */

import { apiFetch, parseErrorDetail } from './client';

export interface AuthSession {
  auth_enabled: boolean;
  authenticated: boolean;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

async function readSession(response: Response): Promise<AuthSession> {
  const text = await response.text();
  if (!response.ok) {
    throw new AuthError(parseErrorDetail(text) ?? 'Unable to check login status.', response.status);
  }
  try {
    return JSON.parse(text) as AuthSession;
  } catch {
    throw new AuthError('Unexpected login response.', response.status);
  }
}

export async function login(password: string): Promise<AuthSession> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  return readSession(response);
}

export async function fetchSession(): Promise<AuthSession> {
  const response = await apiFetch('/auth/session', {
    credentials: 'include',
  });
  return readSession(response);
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  const text = await response.text();
  if (!response.ok) {
    throw new AuthError(parseErrorDetail(text) ?? 'Unable to sign out.', response.status);
  }
}
