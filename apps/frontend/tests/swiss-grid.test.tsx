import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwissGrid } from '@/components/home/swiss-grid';
import { APP_VERSION } from '@/lib/config/version';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

describe('SwissGrid', () => {
  it('shows the Dossiera name beside the version in the footer, in the label face', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    const version = screen.getByText(`v${APP_VERSION}`);
    expect(version).toHaveClass('text-steel');
    const brand = screen.getByText('Dossiera');
    expect(version.parentElement).toBe(brand.parentElement);
    // The footer row sets the label face for the brand line and the version alike.
    expect(brand.closest('.font-mono')).toContainElement(version);
  });

  it('names the tile region with its own heading, not a repeat of the page subtitle', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('sr-only');
    expect(heading).toHaveTextContent('dashboard.modulesHeading');
    // The subtitle keeps dashboard.selectModule; a screen reader must not hear it twice.
    expect(screen.getAllByText(/dashboard\.selectModule/)).toHaveLength(1);
    expect(heading).not.toHaveTextContent('dashboard.selectModule');
  });

  it('links the tailoring queue from the footer as a styled link, not a nested button', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    const link = screen.getByRole('link', { name: 'nav.queue' });
    expect(link).toHaveAttribute('href', '/queue');
    expect(link.querySelector('button')).toBeNull();
    // The footer actions wrap on narrow screens instead of clipping.
    expect(link.parentElement).toHaveClass('flex-wrap');
  });

  it('closes without a community strip', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    const footer = screen.getByRole('link', { name: 'nav.queue' }).closest('div.border-t');
    expect(footer).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'community.follow' })).toBeNull();
    expect(document.querySelector('a[href*="github.com"], a[href*="discord"]')).toBeNull();
  });
});
