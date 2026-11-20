/** Local state and filter helpers for the Find Job workspace. */

import type { JobPosting } from '@/lib/api/job-search';

export const FIND_JOBS_STORAGE_KEY = 'rm.find-jobs.v1';
export const MAX_PAST_SEARCHES = 10;
export const MAX_CACHED_JOBS = 100;

export type LevelFilter = 'any' | 'entry' | 'junior' | 'mid' | 'senior' | 'lead';
export type DetectedLevel = Exclude<LevelFilter, 'any'>;

export interface SearchFilters {
  query: string;
  where: string;
  country: string;
  within: string;
  posted: string;
  level: string;
  remoteOnly: boolean;
}

export interface SavedSearch {
  id: string;
  filters: SearchFilters;
  createdAt: string;
  total: number;
}

export interface StoredJob extends JobPosting {
  storedAt: string;
}

export interface CachedSearchResults {
  filters: SearchFilters;
  jobs: JobPosting[];
  total: number;
  offset: number;
  savedAt: string;
}

export interface FindJobsStore {
  pastSearches: SavedSearch[];
  saved: StoredJob[];
  dismissed: StoredJob[];
  lastResults: CachedSearchResults | null;
}

export const EMPTY_FIND_JOBS_STORE: FindJobsStore = {
  pastSearches: [],
  saved: [],
  dismissed: [],
  lastResults: null,
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  query: 'laravel',
  where: '',
  country: 'Pakistan',
  within: '200',
  posted: 'month',
  level: 'any',
  remoteOnly: false,
};

const COUNTRY_CODES: Record<string, string> = {
  any: '',
  anywhere: '',
  global: '',
  pakistan: 'pk',
  germany: 'de',
  deutschland: 'de',
  'united states': 'us',
  usa: 'us',
  'united kingdom': 'gb',
  uk: 'gb',
  canada: 'ca',
  india: 'in',
  australia: 'au',
  netherlands: 'nl',
  france: 'fr',
  spain: 'es',
  italy: 'it',
  brazil: 'br',
  japan: 'jp',
  'south korea': 'kr',
  korea: 'kr',
  china: 'cn',
  austria: 'at',
  switzerland: 'ch',
};

const POSTED_DAYS: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  threeMonths: 90,
  year: 365,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asFilters(value: unknown): SearchFilters | null {
  if (!isRecord(value) || typeof value.query !== 'string') return null;
  return {
    query: value.query,
    where: text(value.where),
    country: text(value.country),
    within: text(value.within, '200'),
    posted: text(value.posted, 'month'),
    level: text(value.level, 'any'),
    remoteOnly: Boolean(value.remoteOnly),
  };
}

function asStoredJob(value: unknown): StoredJob | null {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.company !== 'string') {
    return null;
  }
  return {
    id: text(value.id),
    title: value.title,
    company: value.company,
    location: typeof value.location === 'string' ? value.location : null,
    url: typeof value.url === 'string' ? value.url : null,
    description: text(value.description),
    source: typeof value.source === 'string' ? value.source : null,
    source_id: typeof value.source_id === 'string' ? value.source_id : null,
    posted_at: typeof value.posted_at === 'string' ? value.posted_at : null,
    skills: stringList(value.skills),
    work_mode: typeof value.work_mode === 'string' ? value.work_mode : null,
    storedAt: text(value.storedAt, new Date().toISOString()),
  };
}

function asSavedSearch(value: unknown): SavedSearch | null {
  if (!isRecord(value)) return null;
  const filters = asFilters(value.filters);
  if (!filters) return null;
  return {
    id: text(value.id, createId()),
    filters,
    createdAt: text(value.createdAt, new Date().toISOString()),
    total: typeof value.total === 'number' && Number.isFinite(value.total) ? value.total : 0,
  };
}

function asCachedResults(value: unknown): CachedSearchResults | null {
  if (!isRecord(value) || !Array.isArray(value.jobs)) return null;
  const filters = asFilters(value.filters);
  if (!filters) return null;
  return {
    filters,
    jobs: value.jobs
      .map(asStoredJob)
      .filter((job): job is StoredJob => job !== null)
      .slice(0, MAX_CACHED_JOBS),
    total: typeof value.total === 'number' && Number.isFinite(value.total) ? value.total : 0,
    offset: typeof value.offset === 'number' && Number.isFinite(value.offset) ? value.offset : 0,
    savedAt: text(value.savedAt, new Date().toISOString()),
  };
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Read local Find Job state. Corrupt or unavailable storage is treated as empty. */
export function loadFindJobsStore(): FindJobsStore {
  if (typeof window === 'undefined') return EMPTY_FIND_JOBS_STORE;
  try {
    const raw = window.localStorage.getItem(FIND_JOBS_STORAGE_KEY);
    if (!raw) return EMPTY_FIND_JOBS_STORE;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_FIND_JOBS_STORE;
    return {
      pastSearches: Array.isArray(parsed.pastSearches)
        ? parsed.pastSearches
            .map(asSavedSearch)
            .filter((item): item is SavedSearch => item !== null)
            .slice(0, MAX_PAST_SEARCHES)
        : [],
      saved: Array.isArray(parsed.saved)
        ? parsed.saved
            .filter((item): item is StoredJob => asStoredJob(item) !== null)
            .map((item) => asStoredJob(item) as StoredJob)
        : [],
      dismissed: Array.isArray(parsed.dismissed)
        ? parsed.dismissed
            .filter((item): item is StoredJob => asStoredJob(item) !== null)
            .map((item) => asStoredJob(item) as StoredJob)
        : [],
      lastResults: asCachedResults(parsed.lastResults),
    };
  } catch {
    return EMPTY_FIND_JOBS_STORE;
  }
}

/** Persist local Find Job state. Storage failures must not break the UI. */
export function saveFindJobsStore(store: FindJobsStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FIND_JOBS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing or a full quota: keep the in-memory state usable.
  }
}

/** Stable identity for a posting, even when a source omits its id. */
export function jobKey(job: Pick<JobPosting, 'id' | 'url' | 'title' | 'company'>): string {
  if (job.id) return `id:${job.id}`;
  if (job.url) return `url:${job.url}`;
  return `job:${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
}

function sameSearch(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.query.trim().toLowerCase() === b.query.trim().toLowerCase() &&
    a.where.trim().toLowerCase() === b.where.trim().toLowerCase() &&
    a.country.trim().toLowerCase() === b.country.trim().toLowerCase() &&
    a.within === b.within &&
    a.posted === b.posted &&
    a.level === b.level &&
    a.remoteOnly === b.remoteOnly
  );
}

/** Prepend a search, de-duplicate it, and keep only the ten most recent. */
export function addPastSearch(
  store: FindJobsStore,
  filters: SearchFilters,
  total: number
): FindJobsStore {
  const entry: SavedSearch = {
    id: createId(),
    filters: { ...filters },
    createdAt: new Date().toISOString(),
    total,
  };
  return {
    ...store,
    pastSearches: [
      entry,
      ...store.pastSearches.filter((item) => !sameSearch(item.filters, filters)),
    ].slice(0, MAX_PAST_SEARCHES),
  };
}

export function cacheSearchResults(
  store: FindJobsStore,
  results: Omit<CachedSearchResults, 'savedAt'>
): FindJobsStore {
  return {
    ...store,
    lastResults: {
      ...results,
      filters: { ...results.filters },
      jobs: results.jobs.slice(0, MAX_CACHED_JOBS).map(toStoredJob),
      savedAt: new Date().toISOString(),
    },
  };
}

export function removePastSearch(store: FindJobsStore, id: string): FindJobsStore {
  return { ...store, pastSearches: store.pastSearches.filter((item) => item.id !== id) };
}

export function toStoredJob(job: JobPosting): StoredJob {
  return { ...job, storedAt: new Date().toISOString() };
}

export function toggleSavedJob(store: FindJobsStore, job: JobPosting): FindJobsStore {
  const key = jobKey(job);
  const alreadySaved = store.saved.some((item) => jobKey(item) === key);
  return {
    ...store,
    saved: alreadySaved
      ? store.saved.filter((item) => jobKey(item) !== key)
      : [toStoredJob(job), ...store.saved.filter((item) => jobKey(item) !== key)],
    dismissed: store.dismissed.filter((item) => jobKey(item) !== key),
  };
}

export function dismissJob(store: FindJobsStore, job: JobPosting): FindJobsStore {
  const key = jobKey(job);
  return {
    ...store,
    saved: store.saved.filter((item) => jobKey(item) !== key),
    dismissed: [toStoredJob(job), ...store.dismissed.filter((item) => jobKey(item) !== key)],
  };
}

export function restoreJob(store: FindJobsStore, job: JobPosting): FindJobsStore {
  const key = jobKey(job);
  return { ...store, dismissed: store.dismissed.filter((item) => jobKey(item) !== key) };
}

export function removeSavedJob(store: FindJobsStore, job: JobPosting): FindJobsStore {
  const key = jobKey(job);
  return { ...store, saved: store.saved.filter((item) => jobKey(item) !== key) };
}

export function removeDismissedJob(store: FindJobsStore, job: JobPosting): FindJobsStore {
  const key = jobKey(job);
  return { ...store, dismissed: store.dismissed.filter((item) => jobKey(item) !== key) };
}

/** Convert the visible country text to the ISO code FreeHire expects. */
export function normalizeCountry(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (COUNTRY_CODES[trimmed] === '') return undefined;
  return COUNTRY_CODES[trimmed] ?? (/^[a-z]{2}$/.test(trimmed) ? trimmed : undefined);
}

/** Infer a seniority bucket from the posting title and the years it asks for. */
export function inferLevel(job: Pick<JobPosting, 'title' | 'description'>): DetectedLevel | null {
  const title = job.title.toLowerCase();
  const description = job.description.toLowerCase();
  const years: number[] = [];
  for (const match of description.matchAll(
    /(\d{1,2})(?:\s*\+)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*(?:years?|yrs?)/g
  )) {
    const upper = Number(match[2] ?? match[1]);
    if (Number.isFinite(upper)) years.push(upper);
  }
  const maxYears = years.length > 0 ? Math.max(...years) : null;

  // Seniority words are read from the title only, so phrases like "lead
  // management" in a posting body cannot turn a mid-level role into a Lead.
  if (
    /\b(lead|principal|staff|head of|director|architect)\b/.test(title) ||
    (maxYears !== null && maxYears >= 8)
  ) {
    return 'lead';
  }
  if (/\b(senior|sr\.?)\b/.test(title) || (maxYears !== null && maxYears >= 5)) {
    return 'senior';
  }
  if (/\b(entry[- ]level|graduate|intern|trainee)\b/.test(title)) return 'entry';
  if (/\b(junior|jr\.?)\b/.test(title) || (maxYears !== null && maxYears <= 1)) return 'junior';
  if (/\b(mid[- ]?level|intermediate|mid)\b/.test(title) || (maxYears !== null && maxYears >= 3)) {
    return 'mid';
  }
  return null;
}

/** True when a posted date is inside the selected range. Unknown dates fail closed. */
export function postedWithin(postedAt: string | null, posted: string): boolean {
  if (posted === 'any') return true;
  const days = POSTED_DAYS[posted];
  if (!days || !postedAt) return false;
  const timestamp = Date.parse(postedAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function isRemote(job: JobPosting): boolean {
  return job.work_mode === 'remote' || /\bremote\b/i.test(`${job.title} ${job.description}`);
}

/** Apply the filters the search API cannot do server-side. Distance is not filterable. */
export function filterJobs(jobs: JobPosting[], filters: SearchFilters): JobPosting[] {
  const where = filters.where.trim().toLowerCase();
  return jobs.filter((job) => {
    if (where) {
      const haystack = `${job.location ?? ''} ${job.title} ${job.company}`.toLowerCase();
      if (!haystack.includes(where)) return false;
    }
    if (!postedWithin(job.posted_at, filters.posted)) return false;
    if (filters.level !== 'any' && inferLevel(job) !== filters.level) return false;
    if (filters.remoteOnly && !isRemote(job)) return false;
    return true;
  });
}

/** Compact markdown text for a result-card preview. */
export function previewDescription(description: string, limit = 240): string {
  const plain = description
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit).trimEnd()}…` : plain;
}
