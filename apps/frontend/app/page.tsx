'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageFrame } from '@/components/ui/page-frame';
import { LanguageProvider } from '@/lib/context/language-context';
import { useTranslations } from '@/lib/i18n/translations';
import { AuthError, fetchSession, login } from '@/lib/api/auth';

function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  // Only allow local paths so the sign-in page cannot be used as an open redirect.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

function LoginForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const session = await fetchSession();
        if (!active) return;
        if (!session.auth_enabled || session.authenticated) {
          router.replace(safeNextPath());
          return;
        }
      } catch {
        if (!active) return;
        setError(t('login.error'));
      } finally {
        if (active) setChecking(false);
      }
    };
    void checkSession();
    return () => {
      active = false;
    };
  }, [router, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || checking) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      router.replace(safeNextPath());
      router.refresh();
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setError(t('login.invalidPassword'));
      } else if (err instanceof AuthError && err.status === 503) {
        setError(t('login.unavailable'));
      } else {
        setError(t('login.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame width="default" effect="none">
      <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
        {/* Password form on the left. */}
        <section className="order-2 flex flex-col justify-center border-t border-ink p-8 md:order-1 md:border-r md:border-t-0 md:p-12">
          <header className="mb-8">
            <h1 className="font-serif text-4xl font-bold uppercase leading-none tracking-tight text-ink md:text-5xl">
              {t('login.title')}
            </h1>
            <p className="mt-4 font-mono text-sm font-bold uppercase tracking-wide text-steel">
              {'// '}
              {t('login.subtitle')}
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert tone="error" title={t('common.error')}>
                {error}
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="app-password">{t('login.passwordLabel')}</Label>
              <Input
                id="app-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={checking || submitting}
                aria-invalid={Boolean(error)}
              />
            </div>
            <Button type="submit" disabled={checking || submitting} className="w-full">
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </section>

        {/* Oversized brand mark on the right. */}
        <section className="order-1 flex min-h-64 flex-col items-center justify-center gap-6 border-b border-ink bg-paper p-8 md:order-2 md:min-h-[40rem] md:border-b-0 md:p-12">
          <Image
            src="/logo.svg"
            alt=""
            width={192}
            height={192}
            priority
            className="size-28 md:size-48"
          />
          <div className="text-center">
            <p className="font-serif text-4xl font-bold uppercase leading-none tracking-tight text-ink md:text-6xl">
              <span className="block">{t('home.brandLine1')}</span>
              <span className="block text-primary">{t('home.brandLine2')}</span>
            </p>
            <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wide text-steel">
              {'// '}
              {t('dashboard.subtitle')}
            </p>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>
  );
}
