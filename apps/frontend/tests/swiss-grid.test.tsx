import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwissGrid } from '@/components/home/swiss-grid';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

describe('SwissGrid', () => {
  it('names the tile region with its own heading, not a repeat of the page subtitle', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('sr-only');
    expect(heading).toHaveTextContent('dashboard.modulesHeading');
    // The subtitle keeps dashboard.selectModule; a screen reader must not hear it twice.
    expect(screen.getAllByText(/dashboard\.selectModule/)).toHaveLength(1);
    expect(heading).not.toHaveTextContent('dashboard.selectModule');
  });

  it('keeps module links in the global nav, out of the dashboard grid', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    for (const name of ['nav.queue', 'nav.applicationTracker', 'nav.settings']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
  });

  it('has no bottom brand or community rows', () => {
    render(<SwissGrid>{null}</SwissGrid>);

    expect(screen.queryByText('Resume Matcher')).toBeNull();
    expect(screen.queryByRole('link', { name: 'community.follow' })).toBeNull();
  });
});
