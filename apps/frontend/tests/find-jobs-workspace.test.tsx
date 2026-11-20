import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindJobsWorkspace } from '@/components/find-jobs/find-jobs-workspace';
import { fetchFeatureConfig, type FeatureConfig } from '@/lib/api/config';
import { searchJobs, type JobPosting, type JobSearchResponse } from '@/lib/api/job-search';
import { DEFAULT_SEARCH_FILTERS, FIND_JOBS_STORAGE_KEY, type SearchFilters } from '@/lib/find-jobs';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('@/lib/api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/config')>()),
  fetchFeatureConfig: vi.fn(),
}));

vi.mock('@/lib/api/job-search', () => ({ searchJobs: vi.fn() }));

const config: FeatureConfig = {
  enable_cover_letter: true,
  enable_outreach_message: true,
  enable_interview_prep: true,
  job_search_provider: 'freehire',
};

const job = (overrides: Partial<JobPosting> = {}): JobPosting => ({
  id: 'j1',
  title: 'Senior Laravel Engineer',
  company: 'Acme',
  location: 'Karachi, Pakistan',
  url: 'https://jobs.example/senior-laravel',
  description: 'Build Laravel APIs. 6 years of experience required. Remote friendly.',
  source: 'greenhouse',
  source_id: 'gh-1',
  posted_at: new Date().toISOString(),
  skills: ['laravel', 'php'],
  work_mode: 'remote',
  ...overrides,
});

const response = (jobs: JobPosting[]): JobSearchResponse => ({
  provider: 'freehire',
  jobs,
  total: jobs.length,
  limit: 20,
  offset: 0,
});

const setProvider = (job_search_provider: FeatureConfig['job_search_provider']) => {
  vi.mocked(fetchFeatureConfig).mockResolvedValue({ ...config, job_search_provider });
};

describe('FindJobsWorkspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(fetchFeatureConfig).mockReset();
    vi.mocked(searchJobs).mockReset();
    setProvider('freehire');
  });

  it('shows the requested tabs, fields, defaults and FreeHire notes', async () => {
    render(<FindJobsWorkspace />);

    expect(screen.getByRole('tab', { name: 'findJobs.tabs.search' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'findJobs.tabs.pastSearches 0' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'findJobs.tabs.saved 0' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'findJobs.tabs.dismissed' })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'findJobs.what' })).toHaveValue('laravel');
    expect(screen.getByRole('textbox', { name: 'findJobs.where' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'findJobs.country' })).toHaveValue('Pakistan');
    expect(
      screen.getByRole('button', { name: 'findJobs.posted findJobs.postedOptions.month' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'findJobs.level findJobs.levelOptions.any' })
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'findJobs.remoteOnly' })).not.toBeChecked();

    expect(screen.getByText('findJobs.noDistanceFilter')).toBeInTheDocument();
    expect(screen.getByText('findJobs.levelHelp')).toBeInTheDocument();

    await waitFor(() => expect(fetchFeatureConfig).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'findJobs.within findJobs.withinOptions.200' })
      ).toBeDisabled()
    );
  });

  it('searches with the selected source and renders result cards', async () => {
    vi.mocked(searchJobs).mockResolvedValue(
      response([job(), job({ id: 'j2', title: 'Laravel Developer' })])
    );
    render(<FindJobsWorkspace />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'findJobs.search' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'findJobs.search' }));

    expect(await screen.findAllByText('Senior Laravel Engineer')).toHaveLength(2);
    expect(searchJobs).toHaveBeenCalledWith({
      query: 'laravel',
      limit: 20,
      offset: 0,
      country: 'pk',
    });
    // The selected job appears in both the compact list and the details pane,
    // but actions exist only in the details pane.
    expect(screen.getAllByText('Acme')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /findJobs\.save: / })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /findJobs\.dismiss: / })).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'nav.tailor: Senior Laravel Engineer' })
    ).toHaveAttribute(
      'href',
      `/tailor?jobUrl=${encodeURIComponent('https://jobs.example/senior-laravel')}`
    );
  });

  it('changes the details pane when a job is selected from the left list', async () => {
    vi.mocked(searchJobs).mockResolvedValue(
      response([job(), job({ id: 'j2', title: 'Laravel Developer' })])
    );
    render(<FindJobsWorkspace />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'findJobs.search' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'findJobs.search' }));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Senior Laravel Engineer' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Laravel Developer' }));

    expect(
      screen.getByRole('heading', { level: 3, name: 'Laravel Developer' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Senior Laravel Engineer' })).toBeNull();
  });

  it('restores cached results after a refresh without another API call', async () => {
    vi.mocked(searchJobs).mockResolvedValue(response([job()]));
    const view = render(<FindJobsWorkspace />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'findJobs.search' })).toBeEnabled()
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'findJobs.what' }), {
      target: { value: 'php' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'findJobs.search' }));
    expect(await screen.findAllByText('Senior Laravel Engineer')).toHaveLength(2);
    expect(searchJobs).toHaveBeenCalledTimes(1);
    view.unmount();

    render(<FindJobsWorkspace />);

    expect(await screen.findAllByText('Senior Laravel Engineer')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'findJobs.what' })).toHaveValue('php');
    expect(searchJobs).toHaveBeenCalledTimes(1);
  });

  it('saves and dismisses postings into their tabs', async () => {
    vi.mocked(searchJobs).mockResolvedValue(
      response([job(), job({ id: 'j2', title: 'Laravel Developer' })])
    );
    render(<FindJobsWorkspace />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'findJobs.search' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'findJobs.search' }));
    expect(await screen.findAllByText('Senior Laravel Engineer')).toHaveLength(2);

    const saveButton = screen.getByRole('button', {
      name: 'findJobs.save: Senior Laravel Engineer',
    });
    fireEvent.click(saveButton);
    expect(screen.getByRole('tab', { name: 'findJobs.tabs.saved 1' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'findJobs.dismiss: Senior Laravel Engineer' })
    );
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(FIND_JOBS_STORAGE_KEY) ?? '{}');
      expect(stored.dismissed).toHaveLength(1);
    });
  });

  it('disables search when the source is off', async () => {
    setProvider('off');
    render(<FindJobsWorkspace />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'findJobs.search' })).toBeDisabled()
    );
    expect(searchJobs).not.toHaveBeenCalled();
  });

  it('re-runs a past search with its saved filters', async () => {
    const pastFilters: SearchFilters = {
      ...DEFAULT_SEARCH_FILTERS,
      query: 'php',
      country: 'Pakistan',
      remoteOnly: true,
    };
    window.localStorage.setItem(
      FIND_JOBS_STORAGE_KEY,
      JSON.stringify({
        pastSearches: [
          { id: 'p1', filters: pastFilters, createdAt: new Date().toISOString(), total: 3 },
        ],
        saved: [],
        dismissed: [],
      })
    );
    vi.mocked(searchJobs).mockResolvedValue(response([]));
    render(<FindJobsWorkspace />);

    const pastTab = await screen.findByRole('tab', { name: 'findJobs.tabs.pastSearches 1' });
    fireEvent.click(pastTab);
    fireEvent.click(await screen.findByRole('button', { name: 'findJobs.runAgain' }));

    await waitFor(() => expect(searchJobs).toHaveBeenCalledTimes(1));
    expect(searchJobs).toHaveBeenCalledWith({
      query: 'php',
      limit: 20,
      offset: 0,
      country: 'pk',
      work_mode: 'remote',
    });
  });
});
