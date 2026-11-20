'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { SpinnerGap, X } from '@phosphor-icons/react';
import { fetchFeatureConfig, JOB_SEARCH_PROVIDERS, type JobSearchProvider } from '@/lib/api/config';
import { searchJobs, type JobPosting } from '@/lib/api/job-search';
import {
  addPastSearch,
  cacheSearchResults,
  DEFAULT_SEARCH_FILTERS,
  dismissJob,
  EMPTY_FIND_JOBS_STORE,
  filterJobs,
  jobKey,
  loadFindJobsStore,
  normalizeCountry,
  removeDismissedJob,
  removePastSearch,
  removeSavedJob,
  restoreJob,
  saveFindJobsStore,
  toggleSavedJob,
  type FindJobsStore,
  type SearchFilters,
} from '@/lib/find-jobs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dropdown, type DropdownOption } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RetroTabs } from '@/components/ui/retro-tabs';
import { useTranslations } from '@/lib/i18n';
import type { JobActionView } from './job-actions';
import { JobDetailPanel } from './job-detail-panel';
import { JobListItem } from './job-list-item';

type TabId = 'search' | 'past' | 'saved' | 'dismissed';
type JobView = JobActionView;

const PAGE_SIZE = 20;

/** Find Job workspace: server-selected source, filters, and local job triage. */
export function FindJobsWorkspace() {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [provider, setProvider] = useState<JobSearchProvider | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<FindJobsStore>(EMPTY_FIND_JOBS_STORE);
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadFindJobsStore();
    setStore(stored);
    if (stored.lastResults) {
      setFilters(stored.lastResults.filters);
      setJobs(stored.lastResults.jobs);
      setTotal(stored.lastResults.total);
      setOffset(stored.lastResults.offset);
    }
    let active = true;
    void fetchFeatureConfig()
      .then((config) => {
        if (active) setProvider(config.job_search_provider ?? 'off');
      })
      .catch(() => {
        if (active) setProvider('off');
      });
    return () => {
      active = false;
    };
  }, []);

  const updateStore = (updater: (current: FindJobsStore) => FindJobsStore) => {
    setStore((current) => {
      const next = updater(current);
      saveFindJobsStore(next);
      return next;
    });
  };

  const selectedSource = JOB_SEARCH_PROVIDERS.find((source) => source.id === provider);
  const sourceReady = provider === 'freehire';

  const dismissedKeys = useMemo(
    () => new Set(store.dismissed.map((job) => jobKey(job))),
    [store.dismissed]
  );
  const savedKeys = useMemo(() => new Set(store.saved.map((job) => jobKey(job))), [store.saved]);
  const visibleJobs = useMemo(
    () => filterJobs(jobs, filters).filter((job) => !dismissedKeys.has(jobKey(job))),
    [jobs, filters, dismissedKeys]
  );

  const withinOptions: DropdownOption[] = [
    { id: 'any', label: t('findJobs.withinOptions.any') },
    { id: '10', label: t('findJobs.withinOptions.10') },
    { id: '25', label: t('findJobs.withinOptions.25') },
    { id: '50', label: t('findJobs.withinOptions.50') },
    { id: '100', label: t('findJobs.withinOptions.100') },
    { id: '200', label: t('findJobs.withinOptions.200') },
  ];
  const postedOptions: DropdownOption[] = [
    { id: 'any', label: t('findJobs.postedOptions.any') },
    { id: 'day', label: t('findJobs.postedOptions.day') },
    { id: 'week', label: t('findJobs.postedOptions.week') },
    { id: 'month', label: t('findJobs.postedOptions.month') },
    { id: 'threeMonths', label: t('findJobs.postedOptions.threeMonths') },
    { id: 'year', label: t('findJobs.postedOptions.year') },
  ];
  const levelOptions: DropdownOption[] = [
    { id: 'any', label: t('findJobs.levelOptions.any') },
    { id: 'entry', label: t('findJobs.levelOptions.entry') },
    { id: 'junior', label: t('findJobs.levelOptions.junior') },
    { id: 'mid', label: t('findJobs.levelOptions.mid') },
    { id: 'senior', label: t('findJobs.levelOptions.senior') },
    { id: 'lead', label: t('findJobs.levelOptions.lead') },
  ];

  const runSearch = async (nextFilters: SearchFilters, nextOffset: number) => {
    if (!nextFilters.query.trim() || !sourceReady || searching) return;
    setSearching(true);
    setError(null);
    setActiveTab('search');
    try {
      const response = await searchJobs({
        query: nextFilters.query.trim(),
        limit: PAGE_SIZE,
        offset: nextOffset,
        country: normalizeCountry(nextFilters.country),
        work_mode: nextFilters.remoteOnly ? 'remote' : undefined,
      });
      const nextJobs =
        nextOffset === 0
          ? response.jobs
          : [...jobs, ...response.jobs].filter(
              (job, index, all) => all.findIndex((other) => jobKey(other) === jobKey(job)) === index
            );
      const nextOffsetValue = response.offset + response.limit;
      setJobs(nextJobs);
      setTotal(response.total);
      setOffset(nextOffsetValue);
      updateStore((current) => {
        const withPastSearch =
          nextOffset === 0 ? addPastSearch(current, nextFilters, response.total) : current;
        return cacheSearchResults(withPastSearch, {
          filters: nextFilters,
          jobs: nextJobs,
          total: response.total,
          offset: nextOffsetValue,
        });
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('findJobs.searchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(filters, 0);
  };

  const applyPastSearch = (searchFilters: SearchFilters) => {
    setFilters(searchFilters);
    void runSearch(searchFilters, 0);
  };

  const renderJobList = (
    items: JobPosting[],
    view: JobView,
    emptyTitle: string,
    emptyHint: string
  ) => {
    if (items.length === 0) {
      return <EmptyState variant="framed" title={emptyTitle} description={emptyHint} />;
    }
    const selected = items.find((job) => jobKey(job) === selectedJobKey) ?? items[0];
    if (!selected) {
      return <EmptyState variant="framed" title={emptyTitle} description={emptyHint} />;
    }
    const actions = {
      onSave: (job: JobPosting) => updateStore((current) => toggleSavedJob(current, job)),
      onDismiss: (job: JobPosting) => updateStore((current) => dismissJob(current, job)),
      onRestore: (job: JobPosting) => updateStore((current) => restoreJob(current, job)),
      onRemove: (job: JobPosting) =>
        updateStore((current) =>
          view === 'saved' ? removeSavedJob(current, job) : removeDismissedJob(current, job)
        ),
    };

    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ol className="space-y-2">
          {items.map((job) => (
            <JobListItem
              key={jobKey(job)}
              job={job}
              isSelected={jobKey(job) === jobKey(selected)}
              onSelect={(item) => setSelectedJobKey(jobKey(item))}
            />
          ))}
        </ol>
        <JobDetailPanel
          job={selected}
          view={view}
          isSaved={savedKeys.has(jobKey(selected))}
          {...actions}
        />
      </div>
    );
  };

  const tabs = [
    { id: 'search', label: t('findJobs.tabs.search') },
    { id: 'past', label: `${t('findJobs.tabs.pastSearches')} ${store.pastSearches.length}` },
    { id: 'saved', label: `${t('findJobs.tabs.saved')} ${store.saved.length}` },
    { id: 'dismissed', label: t('findJobs.tabs.dismissed') },
  ];

  return (
    <>
      <RetroTabs
        idPrefix="find-jobs"
        aria-label={t('findJobs.tabs.label')}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        className="mb-6"
      />

      <div
        role="tabpanel"
        id={`find-jobs-panel-${activeTab}`}
        aria-labelledby={`find-jobs-tab-${activeTab}`}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSubmit}
              aria-label={t('findJobs.tabs.search')}
              className="grid gap-4 border border-ink bg-white p-6 shadow-sw-nested md:grid-cols-2"
            >
              <div className="space-y-1">
                <Label htmlFor="find-jobs-what">{t('findJobs.what')}</Label>
                <Input
                  id="find-jobs-what"
                  value={filters.query}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                  placeholder={t('findJobs.whatPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="find-jobs-where">{t('findJobs.where')}</Label>
                <Input
                  id="find-jobs-where"
                  value={filters.where}
                  onChange={(event) => setFilters({ ...filters, where: event.target.value })}
                  placeholder={t('findJobs.wherePlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="find-jobs-country">{t('findJobs.country')}</Label>
                <Input
                  id="find-jobs-country"
                  value={filters.country}
                  onChange={(event) => setFilters({ ...filters, country: event.target.value })}
                  placeholder={t('findJobs.countryPlaceholder')}
                />
              </div>

              <div>
                <Dropdown
                  label={t('findJobs.within')}
                  options={withinOptions}
                  value={filters.within}
                  onChange={(within) => setFilters({ ...filters, within })}
                  disabled={provider === 'freehire'}
                />
                <p className="mt-1 font-mono text-xs text-steel">
                  {t('findJobs.noDistanceFilter')}
                </p>
              </div>

              <Dropdown
                label={t('findJobs.posted')}
                options={postedOptions}
                value={filters.posted}
                onChange={(posted) => setFilters({ ...filters, posted })}
              />

              <div>
                <Dropdown
                  label={t('findJobs.level')}
                  options={levelOptions}
                  value={filters.level}
                  onChange={(level) => setFilters({ ...filters, level })}
                />
                <p className="mt-1 font-mono text-xs text-steel">{t('findJobs.levelHelp')}</p>
              </div>

              <div className="flex items-end justify-between gap-4 md:col-span-2">
                <label
                  htmlFor="find-jobs-remote"
                  className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-ink-soft"
                >
                  <input
                    id="find-jobs-remote"
                    type="checkbox"
                    checked={filters.remoteOnly}
                    onChange={(event) =>
                      setFilters({ ...filters, remoteOnly: event.target.checked })
                    }
                    className="size-4 accent-primary"
                  />
                  {t('findJobs.remoteOnly')}
                </label>
                <Button type="submit" disabled={!filters.query.trim() || !sourceReady || searching}>
                  {searching ? <SpinnerGap aria-hidden="true" className="animate-spin" /> : null}
                  {searching ? t('findJobs.searching') : t('findJobs.search')}
                </Button>
              </div>
            </form>

            {error && <Alert tone="error">{error}</Alert>}

            <section aria-labelledby="find-jobs-results-title" className="space-y-3">
              <div className="sticky top-0 z-20 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink bg-canvas py-2">
                <h2
                  id="find-jobs-results-title"
                  className="font-serif text-2xl font-bold uppercase text-ink"
                >
                  {t('findJobs.results')}
                </h2>
                <span className="font-mono text-xs uppercase text-steel">
                  {t('findJobs.resultCount', { count: visibleJobs.length })}
                  {total > 0 &&
                    ` · ${t('findJobs.totalCount', { count: total, provider: selectedSource ? t(selectedSource.titleKey) : (provider ?? '') })}`}
                </span>
              </div>

              {searching && jobs.length === 0 && (
                <p className="font-mono text-sm text-steel">{t('findJobs.searching')}</p>
              )}

              {!searching && jobs.length === 0 && (
                <EmptyState
                  variant="framed"
                  title={t('findJobs.noResults')}
                  description={t('findJobs.noResultsHint')}
                />
              )}

              {jobs.length > 0 &&
                renderJobList(
                  visibleJobs,
                  'results',
                  t('findJobs.noResults'),
                  t('findJobs.noResultsHint')
                )}

              {jobs.length > 0 && visibleJobs.length === 0 && (
                <Alert tone="info">{t('findJobs.noResultsHint')}</Alert>
              )}

              {jobs.length > 0 && jobs.length < total && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runSearch(filters, offset)}
                    disabled={searching}
                  >
                    {searching ? t('findJobs.loadingMore') : t('findJobs.loadMore')}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'past' && (
          <section className="space-y-3">
            {store.pastSearches.length === 0 ? (
              <EmptyState
                variant="framed"
                title={t('findJobs.emptyPast')}
                description={t('findJobs.emptyPastHint')}
              />
            ) : (
              <ol className="space-y-3">
                {store.pastSearches.map((search) => (
                  <li
                    key={search.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-ink bg-white p-4 shadow-sw-nested"
                  >
                    <div className="min-w-0">
                      <p className="font-serif text-lg font-bold text-ink">
                        {search.filters.query}
                      </p>
                      <p className="mt-1 font-mono text-xs uppercase text-steel">
                        {t('findJobs.searchSummary', {
                          query: search.filters.query,
                          country: search.filters.country || t('findJobs.withinOptions.any'),
                          posted: t(`findJobs.postedOptions.${search.filters.posted}`),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyPastSearch(search.filters)}
                      >
                        {t('findJobs.runAgain')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`${t('findJobs.remove')}: ${search.filters.query}`}
                        onClick={() =>
                          updateStore((current) => removePastSearch(current, search.id))
                        }
                      >
                        <X aria-hidden="true" />
                        {t('findJobs.remove')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {activeTab === 'saved' && (
          <section className="space-y-3">
            {renderJobList(
              store.saved,
              'saved',
              t('findJobs.emptySaved'),
              t('findJobs.emptySavedHint')
            )}
          </section>
        )}

        {activeTab === 'dismissed' && (
          <section className="space-y-3">
            {renderJobList(
              store.dismissed,
              'dismissed',
              t('findJobs.emptyDismissed'),
              t('findJobs.emptyDismissedHint')
            )}
          </section>
        )}
      </div>
    </>
  );
}
