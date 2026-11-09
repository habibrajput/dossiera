import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AppShell, TopNav } from '@/components/navigation/app-shell';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }));
const translations = vi.hoisted(() => ({
  'nav.dashboard': 'Dashboard',
  'nav.resumeBoard': 'Resume Board',
  'nav.findJobs': 'Find jobs',
  'nav.startups': 'Startups',
  'nav.agent': 'Agent',
  'nav.applications': 'Applications',
  'nav.inbox': 'Inbox',
  'nav.primary': 'Primary navigation',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));
vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: keyof typeof translations) => translations[key] ?? key,
  }),
}));

const destinations = [
  ['Dashboard', '/dashboard'],
  ['Resume Board', '/resume-board'],
  ['Find jobs', '/find-jobs'],
  ['Startups', '/startups'],
  ['Agent', '/agent'],
  ['Applications', '/tracker'],
  ['Inbox', '/inbox'],
] as const;

function getPrimaryNavigation(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary navigation' });
}

describe('TopNav', () => {
  beforeEach(() => {
    navigation.pathname = '/dashboard';
  });

  it('renders all seven destinations as links in the requested order', () => {
    render(<TopNav />);

    const links = within(getPrimaryNavigation()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(destinations.map(([label]) => label));
    destinations.forEach(([label, href], index) => {
      expect(links[index]).toHaveAccessibleName(label);
      expect(links[index]).toHaveAttribute('href', href);
    });
  });

  it.each(destinations)('marks only %s as the current page', (label, href) => {
    navigation.pathname = href;
    render(<TopNav />);

    const links = within(getPrimaryNavigation()).getAllByRole('link');
    expect(screen.getByRole('link', { name: label, current: 'page' })).toHaveAttribute(
      'href',
      href
    );
    expect(links.filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('marks a destination active on its nested routes', () => {
    navigation.pathname = '/find-jobs/saved';
    render(<TopNav />);

    expect(within(getPrimaryNavigation()).getByRole('link', { name: 'Find jobs' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});

describe('AppShell', () => {
  it('shows the navigation and page content on product routes', () => {
    navigation.pathname = '/dashboard';
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>
    );

    expect(getPrimaryNavigation()).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Page content');
    expect(main.style.getPropertyValue('--app-viewport-height')).toBe('calc(100dvh - 4rem)');
  });

  it('keeps the landing page free of the product navigation', () => {
    navigation.pathname = '/';
    render(
      <AppShell>
        <p>Landing content</p>
      </AppShell>
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Landing content');
  });
});
