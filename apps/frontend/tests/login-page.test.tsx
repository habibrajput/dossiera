import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  fetchSession: vi.fn(async () => ({ auth_enabled: true, authenticated: false })),
  login: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('@/lib/context/language-context', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/i18n/translations', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));
vi.mock('@/lib/api/auth', () => ({
  AuthError: class AuthError extends Error {},
  fetchSession: mocks.fetchSession,
  login: mocks.login,
}));
vi.mock('@/components/effects/background-effect', () => ({ BackgroundEffect: () => null }));

describe('login page', () => {
  beforeEach(() => {
    mocks.replace.mockClear();
    mocks.refresh.mockClear();
    mocks.login.mockClear();
  });

  it('does not show the authenticated top nav on the login screen', () => {
    render(<LoginPage />);

    expect(screen.queryByRole('navigation', { name: 'nav.main' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'nav.queue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'nav.login' })).toBeNull();
  });

  it('puts the password form on the left and an oversized brand mark on the right', () => {
    const { container } = render(<LoginPage />);

    const password = screen.getByLabelText('login.passwordLabel');
    expect(password).toHaveAttribute('type', 'password');
    const formPanel = password.closest('section');
    expect(formPanel).toHaveClass('md:order-1', 'md:border-r');

    const brandPanel = screen.getByText('home.brandLine1').closest('section');
    expect(brandPanel).toHaveClass('md:order-2', 'bg-paper');
    expect(brandPanel).toContainElement(screen.getByText('home.brandLine2'));

    const logo = container.querySelector('img');
    expect(logo).toHaveAttribute('src', '/logo.svg');
    expect(logo).toHaveClass('md:size-48');
  });
});
