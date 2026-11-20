import { describe, expect, it } from 'vitest';
import type { JobPosting } from '@/lib/api/job-search';
import {
  addPastSearch,
  cacheSearchResults,
  DEFAULT_SEARCH_FILTERS,
  dismissJob,
  EMPTY_FIND_JOBS_STORE,
  filterJobs,
  inferLevel,
  jobKey,
  normalizeCountry,
  postedWithin,
  restoreJob,
  toggleSavedJob,
  type SearchFilters,
} from '@/lib/find-jobs';

const job = (overrides: Partial<JobPosting> = {}): JobPosting => ({
  id: 'j1',
  title: 'Senior Laravel Engineer',
  company: 'Acme',
  location: 'Karachi, Pakistan',
  url: 'https://jobs.example/1',
  description: 'Build Laravel APIs. 6 years of experience required. Remote friendly.',
  source: 'greenhouse',
  source_id: 'gh-1',
  posted_at: new Date().toISOString(),
  skills: ['laravel', 'php'],
  work_mode: 'remote',
  ...overrides,
});

const filters = (overrides: Partial<SearchFilters> = {}): SearchFilters => ({
  ...DEFAULT_SEARCH_FILTERS,
  ...overrides,
});

describe('find job filter helpers', () => {
  it('maps the visible country name to the code FreeHire expects', () => {
    expect(normalizeCountry('Pakistan')).toBe('pk');
    expect(normalizeCountry('Germany')).toBe('de');
    expect(normalizeCountry(' de ')).toBe('de');
    expect(normalizeCountry('Anywhere')).toBeUndefined();
    expect(normalizeCountry('Atlantis')).toBeUndefined();
  });

  it('infers seniority from titles and requested years', () => {
    expect(inferLevel(job())).toBe('senior');
    expect(inferLevel(job({ title: 'Lead Engineer', description: 'Lead the team' }))).toBe('lead');
    expect(inferLevel(job({ title: 'Junior Developer', description: '1 year experience' }))).toBe(
      'junior'
    );
    expect(inferLevel(job({ title: 'Graduate Engineer', description: 'Learn with us' }))).toBe(
      'entry'
    );
    expect(
      inferLevel(job({ title: 'Laravel Developer', description: 'Own lead management workflows' }))
    ).toBeNull();
    expect(inferLevel(job({ title: 'Developer', description: 'No level mentioned' }))).toBeNull();
  });

  it('applies location, posted, level and remote filters', () => {
    const recent = job();
    const old = job({ id: 'old', posted_at: '2020-01-01T00:00:00Z' });
    const onsite = job({ id: 'onsite', work_mode: 'onsite', description: 'On-site role' });

    expect(filterJobs([recent, old], filters({ level: 'any' }))).toEqual([recent]);
    expect(filterJobs([recent, onsite], filters({ remoteOnly: true }))).toEqual([recent]);
    expect(filterJobs([recent], filters({ where: 'karachi' }))).toEqual([recent]);
    expect(filterJobs([recent], filters({ where: 'berlin' }))).toEqual([]);
    expect(filterJobs([recent], filters({ level: 'senior' }))).toEqual([recent]);
    expect(filterJobs([recent], filters({ level: 'lead' }))).toEqual([]);
  });

  it('treats unknown dates as outside a bounded posted range', () => {
    expect(postedWithin(null, 'any')).toBe(true);
    expect(postedWithin(new Date().toISOString(), 'month')).toBe(true);
    expect(postedWithin('2020-01-01T00:00:00Z', 'month')).toBe(false);
    expect(postedWithin('not-a-date', 'week')).toBe(false);
  });

  it('keeps only ten unique past searches', () => {
    let store = EMPTY_FIND_JOBS_STORE;
    for (let index = 0; index < 12; index += 1) {
      store = addPastSearch(store, filters({ query: `search-${index}` }), index);
    }
    expect(store.pastSearches).toHaveLength(10);
    expect(store.pastSearches[0].filters.query).toBe('search-11');
    expect(store.pastSearches.some((item) => item.filters.query === 'search-0')).toBe(false);
  });

  it('de-duplicates an identical past search and moves it to the top', () => {
    const first = addPastSearch(EMPTY_FIND_JOBS_STORE, filters(), 4);
    const second = addPastSearch(first, filters(), 9);
    expect(second.pastSearches).toHaveLength(1);
    expect(second.pastSearches[0].total).toBe(9);
  });

  it('caches the latest results with the filters that produced them', () => {
    const searchFilters = filters({ query: 'php', country: 'Germany' });
    const cached = cacheSearchResults(EMPTY_FIND_JOBS_STORE, {
      filters: searchFilters,
      jobs: [job()],
      total: 12,
      offset: 20,
    });

    expect(cached.lastResults?.filters).toEqual(searchFilters);
    expect(cached.lastResults?.jobs.map(jobKey)).toEqual([jobKey(job())]);
    expect(cached.lastResults?.total).toBe(12);
    expect(cached.lastResults?.offset).toBe(20);
  });

  it('saves, dismisses and restores a posting consistently', () => {
    const listing = job();
    const saved = toggleSavedJob(EMPTY_FIND_JOBS_STORE, listing);
    expect(saved.saved.map(jobKey)).toContain(jobKey(listing));

    const dismissed = dismissJob(saved, listing);
    expect(dismissed.saved).toHaveLength(0);
    expect(dismissed.dismissed.map(jobKey)).toContain(jobKey(listing));

    const restored = restoreJob(dismissed, listing);
    expect(restored.dismissed).toHaveLength(0);
  });
});
