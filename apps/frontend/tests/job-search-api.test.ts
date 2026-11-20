import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJobPosting, searchJobs } from '@/lib/api/job-search';

describe('searchJobs', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the query to the server-owned search endpoint', async () => {
    const response = {
      provider: 'freehire',
      jobs: [],
      total: 0,
      limit: 10,
      offset: 0,
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    await expect(searchJobs({ query: 'python', country: 'de', skills: ['go'] })).resolves.toEqual(
      response
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/jobs/search',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'python', country: 'de', skills: ['go'] }),
      })
    );
  });

  it('surfaces the server error detail', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Job search is off.' }), { status: 409 })
    );

    await expect(searchJobs({ query: 'python' })).rejects.toThrow('Job search is off.');
  });
});

describe('fetchJobPosting', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the URL to the server-owned extraction endpoint', async () => {
    const response = {
      url: 'https://jobs.example/role',
      final_url: 'https://jobs.example/role',
      title: 'Senior Go Engineer',
      company: 'Acme',
      location: null,
      work_mode: null,
      skills: [],
      job_req_id: null,
      description: 'Build the API.',
      source: 'html',
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    await expect(fetchJobPosting(response.url)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/jobs/fetch-posting',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ url: response.url }),
      })
    );
  });

  it('surfaces the server error detail', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'That link is not allowed.' }), { status: 400 })
    );

    await expect(fetchJobPosting('http://127.0.0.1')).rejects.toThrow('That link is not allowed.');
  });
});
