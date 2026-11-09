import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { safeReturnTo } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in | Resume Matcher',
};

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const requestedReturnTo = Array.isArray(query?.next) ? query.next[0] : query?.next;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 md:p-8">
      <section
        className="w-full max-w-md border border-ink bg-white p-6 shadow-sw-lg md:p-12"
        aria-labelledby="login-title"
      >
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
          Resume / Matcher
        </p>
        <h1
          id="login-title"
          className="mt-6 font-serif text-4xl font-bold uppercase leading-none tracking-tight text-ink"
        >
          Private workspace
        </h1>
        <p className="mt-4 font-mono text-xs font-bold uppercase leading-relaxed tracking-wide text-steel">
          {'// Enter your password to continue'}
        </p>
        <LoginForm returnTo={safeReturnTo(requestedReturnTo)} />
      </section>
    </main>
  );
}
