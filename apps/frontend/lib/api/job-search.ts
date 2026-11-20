/** Client for the server-side job search endpoint. */

import { apiFetch } from './client';
import type { JobSearchProvider } from './config';

export interface JobSearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  country?: string;
  work_mode?: 'remote' | 'hybrid' | 'onsite';
  skills?: string[];
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string;
  source: string | null;
  source_id: string | null;
  posted_at: string | null;
  skills: string[];
  work_mode: string | null;
}

export interface JobSearchResponse {
  provider: JobSearchProvider;
  jobs: JobPosting[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchedJobPosting {
  url: string;
  final_url: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: string | null;
  skills: string[];
  job_req_id: string | null;
  description: string;
  source: string | null;
}

/** Fetch a pasted posting URL. The server validates the URL and extracts the text. */
export async function fetchJobPosting(url: string): Promise<FetchedJobPosting> {
  const res = await apiFetch('/jobs/fetch-posting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to fetch the job posting (status ${res.status}).`);
  }

  return res.json();
}

/** Search with the source selected in Settings. The server owns the choice. */
export async function searchJobs(request: JobSearchRequest): Promise<JobSearchResponse> {
  const res = await apiFetch('/jobs/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to search jobs (status ${res.status}).`);
  }

  return res.json();
}
