/**
 * Authentication API helpers.
 *
 * The password-only session is managed by an HTTP-only cookie; the UI only
 * needs to ask whether the optional guard is active and revoke a session.
 */
import { apiFetch } from './client';

export interface AuthState {
  authenticated: boolean;
  authRequired: boolean;
}

export async function fetchAuthState(): Promise<AuthState> {
  const response = await apiFetch('/auth/session', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to load authentication state');
  return (await response.json()) as AuthState;
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Failed to sign out');
}
