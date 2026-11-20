import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobSearchSettings } from '@/components/settings/job-search-settings';

const mocks = vi.hoisted(() => ({
  fetchFeatureConfig: vi.fn(async () => ({
    enable_cover_letter: false,
    enable_outreach_message: false,
    enable_interview_prep: false,
    job_search_provider: 'off' as const,
  })),
  updateFeatureConfig: vi.fn(
    async (update: {
      job_search_provider?: 'jsearch' | 'adzuna' | 'freehire' | 'arbeitsagentur' | 'off';
    }) => ({
      enable_cover_letter: false,
      enable_outreach_message: false,
      enable_interview_prep: false,
      job_search_provider: update.job_search_provider ?? 'off',
    })
  ),
  fetchApiKeyStatus: vi.fn(async () => ({
    providers: [
      { provider: 'jsearch', configured: false, masked_key: null },
      { provider: 'adzuna', configured: false, masked_key: null },
    ],
  })),
  updateApiKeys: vi.fn(async () => ({ message: 'ok', updated_providers: ['jsearch'] })),
  deleteApiKey: vi.fn(async () => {}),
}));

vi.mock('@/lib/api/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/config')>('@/lib/api/config');
  return {
    ...actual,
    fetchFeatureConfig: mocks.fetchFeatureConfig,
    updateFeatureConfig: mocks.updateFeatureConfig,
    fetchApiKeyStatus: mocks.fetchApiKeyStatus,
    updateApiKeys: mocks.updateApiKeys,
    deleteApiKey: mocks.deleteApiKey,
  };
});
vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}));

describe('JobSearchSettings', () => {
  beforeEach(() => {
    mocks.fetchFeatureConfig.mockClear();
    mocks.updateFeatureConfig.mockClear();
    mocks.fetchApiKeyStatus.mockClear();
    mocks.updateApiKeys.mockClear();
    mocks.deleteApiKey.mockClear();
  });

  it('lists all five sources with their descriptions and keeps the source setting', async () => {
    render(<JobSearchSettings />);

    for (const key of [
      'settings.jobSearch.jsearchTitle',
      'settings.jobSearch.adzunaTitle',
      'settings.jobSearch.freeHireTitle',
      'settings.jobSearch.arbeitsagenturTitle',
      'settings.jobSearch.offTitle',
      'settings.jobSearch.description',
    ]) {
      expect(screen.getByText(key)).toBeTruthy();
    }
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /settings.jobSearch.offTitle/ })).toBeChecked()
    );
  });

  it('shows a key field only for keyed sources and saves under that source', async () => {
    render(<JobSearchSettings />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /settings.jobSearch.offTitle/ })).toBeChecked()
    );
    expect(screen.queryByLabelText('settings.jobSearch.apiKeyLabel')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /settings.jobSearch.jsearchTitle/ }));
    await waitFor(() =>
      expect(mocks.updateFeatureConfig).toHaveBeenCalledWith({ job_search_provider: 'jsearch' })
    );
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /settings.jobSearch.jsearchTitle/ })).toBeChecked()
    );

    const input = screen.getByLabelText('settings.jobSearch.apiKeyLabel');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'jsearch-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.jobSearch.saveKey' }));

    await waitFor(() =>
      expect(mocks.updateApiKeys).toHaveBeenCalledWith({ jsearch: 'jsearch-secret' })
    );
  });

  it('does not show a key field for key-free sources', async () => {
    render(<JobSearchSettings />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /settings.jobSearch.offTitle/ })).toBeChecked()
    );
    fireEvent.click(screen.getByRole('radio', { name: /settings.jobSearch.freeHireTitle/ }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /settings.jobSearch.freeHireTitle/ })).toBeChecked()
    );
    expect(screen.queryByLabelText('settings.jobSearch.apiKeyLabel')).toBeNull();
    expect(screen.getByText('settings.jobSearch.noKeyNeeded')).toBeTruthy();
  });
});
