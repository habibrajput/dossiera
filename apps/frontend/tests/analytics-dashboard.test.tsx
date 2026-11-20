import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnalyticsDashboardPage from '@/app/(default)/dashboard/page';
import en from '@/messages/en.json';
import { applyParams, getNestedValue } from '@/lib/i18n/utils';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string | number>) =>
      applyParams(getNestedValue(en as unknown as Record<string, unknown>, key), params),
  }),
}));

vi.mock('@/components/tracker/manual-add-application-dialog', () => ({
  ManualAddApplicationDialog: () => null,
}));

describe('analytics dashboard', () => {
  it('shows the greeting, summary and range selector', () => {
    render(<AnalyticsDashboardPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon, Habib');
    expect(
      screen.getByText(
        "You've sent 3 applications and heard back from 0. That's a solid run. Keep it going."
      )
    ).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Showing' })).toBeTruthy();
    for (const label of ['Last 30 days', 'Last 90 days', 'All time']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
  });

  it('renders the funnel, week chart and board counts', () => {
    render(<AnalyticsDashboardPage />);

    expect(screen.getByRole('heading', { name: 'Your funnel' })).toBeTruthy();
    expect(screen.getByText("Everything you've sent")).toBeTruthy();
    expect(screen.getByText('3 waiting')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Show the numbers' })).toHaveLength(2);
    expect(screen.getByText('You started 7 applications and sent 3 in this period.')).toBeTruthy();
    for (const label of ['2 Nov', '9 Nov', '16 Nov']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Where things stand' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open board' })).toHaveAttribute('href', '/tracker');
  });

  it('lists all seven items worth a look with their hints', () => {
    render(<AnalyticsDashboardPage />);

    expect(screen.getByRole('heading', { name: 'Worth a look' })).toBeTruthy();
    expect(screen.getByText('7 things')).toBeTruthy();
    expect(screen.getByText('Mohkaab Enterprise, PHP / Laravel Developer')).toBeTruthy();
    expect(screen.getByText('Still a draft, and the deadline was 2 Nov.')).toBeTruthy();
    expect(screen.getByText('WHO&Co., Desarrollador/a Full-Stack')).toBeTruthy();
    expect(screen.getByText('Still a draft, and applications close 4 Dec.')).toBeTruthy();
    expect(screen.getByText('Turing.com, PHP Tech Lead')).toBeTruthy();
    expect(screen.getByText('Still a draft, and applications close 12 Dec.')).toBeTruthy();
    expect(screen.getByText('Cubixsol, Senior Laravel Developer')).toBeTruthy();
    expect(screen.getByText('Still a draft. Ready when you are.')).toBeTruthy();
    expect(screen.getByText('InvoByte, PHP Laravel Developer')).toBeTruthy();
    expect(
      screen.getByText('DevStudio, Full Stack Developer - Laravel & React / Angular / Vue.js')
    ).toBeTruthy();
    expect(screen.getByText('muSharp, Senior Full-Stack Engineer: Laravel + React')).toBeTruthy();
    expect(
      screen.getAllByText('No news for 18 days. A short, friendly follow-up could help.')
    ).toHaveLength(3);
    expect(screen.getByText('Suggest a follow-up after')).toBeTruthy();
    expect(screen.getByText('days without news')).toBeTruthy();
  });

  it('shows the November 2026 calendar in the user time zone', () => {
    render(<AnalyticsDashboardPage />);

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeTruthy();
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.getByText('Nothing in the next 7 days.')).toBeTruthy();
    expect(screen.getByText('In your time zone (Asia/Karachi).')).toBeTruthy();
  });
});
