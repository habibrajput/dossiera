import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileMenu } from '@/components/navigation/profile-menu';
import { fetchAuthState, logout } from '@/lib/api/auth';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: router.refresh,
    replace: router.replace,
  }),
}));

vi.mock('@/lib/api/auth', () => ({
  fetchAuthState: vi.fn(),
  logout: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('ProfileMenu', () => {
  it('opens an accessible menu with Settings and logout actions', () => {
    render(<ProfileMenu />);

    const trigger = screen.getByRole('button', { name: 'nav.profile' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'nav.profile' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getByRole('menuitem', { name: 'nav.settings' })).toHaveAttribute(
      'href',
      '/settings'
    );
    expect(screen.getByRole('menuitem', { name: 'nav.logout' })).toBeEnabled();
  });

  it('closes the menu after choosing Settings', () => {
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.profile' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'nav.settings' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signs out and returns to login when authentication is required', async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(fetchAuthState).mockResolvedValue({ authenticated: false, authRequired: true });
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.profile' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'nav.logout' }));
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signs out but stays in the app when authentication is disabled', async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(fetchAuthState).mockResolvedValue({ authenticated: true, authRequired: false });
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.profile' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'nav.logout' }));
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps the menu open and reports a failed sign-out', async () => {
    vi.mocked(logout).mockRejectedValue(new Error('offline'));
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.profile' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'nav.logout' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('nav.logoutFailed');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
