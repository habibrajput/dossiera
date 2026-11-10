'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKey, SpinnerGap } from '@phosphor-icons/react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace(returnTo);
        return;
      }
      if (response.status === 400) {
        setError('Authentication is not configured for this installation.');
      } else if (response.status === 401) {
        setError('Incorrect password. Please try again.');
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } catch {
      setError('Unable to reach Dossiera. Check that the backend is running.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          maxLength={1024}
          className="h-12 text-base"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={submitting}
        />
      </div>

      {error && (
        <Alert id="login-error" tone="error">
          {error}
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting || !password}>
        {submitting ? (
          <SpinnerGap className="animate-spin" aria-hidden="true" />
        ) : (
          <LockKey aria-hidden="true" />
        )}
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
