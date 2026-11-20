import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopNav } from '@/components/common/top-nav';

const { pathname, replace, logoutMock } = vi.hoisted(() => ({
  pathname: vi.fn(() => '/queue'),
  replace: vi.fn(),
  logoutMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ replace }),
}));
vi.mock('@/lib/api/auth', () => ({ logout: () => logoutMock() }));
vi.mock('@/lib/i18n', () => ({ useTranslations: () => ({ t: (key: string) => key }) }));

const LINKS: Array<[label: string, href: string]> = [
  ['nav.dashboard', '/dashboard'],
  ['nav.resumeBoard', '/resume-board'],
  ['nav.queue', '/queue'],
  ['nav.applicationTracker', '/tracker'],
  ['nav.findJobs', '/find-jobs'],
  ['nav.agent', '/agent'],
];

describe('TopNav', () => {
  beforeEach(() => {
    pathname.mockReturnValue('/queue');
    replace.mockClear();
    logoutMock.mockClear();
  });

  it('exposes every module link in a labelled navigation landmark', () => {
    render(<TopNav />);

    const nav = screen.getByRole('navigation', { name: 'nav.main' });
    const rail = screen.getByRole('link', { name: 'nav.home' }).closest('aside');
    // A compact, full-height icon rail pinned to the viewport on the left.
    expect(rail).toHaveClass('fixed', 'inset-y-0', 'left-0', 'w-12', 'h-dvh', 'border-r');

    for (const [label, href] of LINKS) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(nav).toContainElement(link);
    }
    expect(screen.getByRole('link', { name: 'nav.home' })).toHaveAttribute('href', '/dashboard');
    const hrefs = Array.from(nav.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(hrefs.indexOf('/find-jobs')).toBeLessThan(hrefs.indexOf('/agent'));
    // Settings now lives in the gear menu, not in the main navigation row.
    expect(screen.queryByRole('link', { name: 'nav.settings' })).toBeNull();
  });

  it('shows icon-only buttons whose labels appear on hover or focus', () => {
    render(<TopNav />);

    const link = screen.getByRole('link', { name: 'nav.queue' });
    expect(link.querySelector('svg')).toBeTruthy();
    expect(link).toHaveClass('size-9', 'group');
    // The visible name is a tooltip inside the button, hidden until hover/focus.
    const label = within(link).getByText('nav.queue');
    expect(label).toHaveClass('group-hover:opacity-100', 'group-focus-visible:opacity-100');

    const gear = screen.getByRole('button', { name: 'nav.settings' });
    expect(gear.querySelector('svg')).toBeTruthy();
    expect(within(gear).getByText('nav.settings')).toHaveClass('group-hover:opacity-100');
  });

  it('marks only the current route as active', () => {
    pathname.mockReturnValue('/tracker');
    render(<TopNav />);

    expect(screen.getByRole('link', { name: 'nav.applicationTracker' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    for (const [label] of LINKS.filter(([, href]) => href !== '/tracker')) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
    }
  });

  it('opens a gear menu with settings and sign out, and signs out on request', async () => {
    render(<TopNav />);

    const trigger = screen.getByRole('button', { name: 'nav.settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('menu', { name: 'nav.settings' });
    const settings = screen.getByRole('menuitem', { name: 'nav.settings' });
    const signOut = screen.getByRole('menuitem', { name: 'login.signOut' });
    expect(menu).toContainElement(settings);
    expect(menu).toContainElement(signOut);
    expect(settings).toHaveAttribute('href', '/settings');

    fireEvent.click(signOut);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(logoutMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the gear menu on outside click and on Escape', () => {
    render(<TopNav />);

    const trigger = screen.getByRole('button', { name: 'nav.settings' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'nav.settings' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
