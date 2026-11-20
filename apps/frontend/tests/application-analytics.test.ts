import { describe, expect, it } from 'vitest';
import type { Application, ApplicationStatus } from '@/lib/api/tracker';
import {
  analyticsRangeStart,
  analyticsStageFor,
  buildApplicationAnalytics,
} from '@/lib/analytics/application-analytics';

const NOW = new Date('2026-11-20T12:00:00Z');

function card(
  id: string,
  status: ApplicationStatus,
  overrides: Partial<Application> = {}
): Application {
  return {
    application_id: id,
    job_id: `job-${id}`,
    resume_id: 'res-1',
    master_resume_id: null,
    status,
    company: `Company ${id}`,
    role: `Role ${id}`,
    job_url: null,
    applied_at: '2026-11-15T09:00:00Z',
    notes: null,
    position: 0,
    created_at: '2026-11-14T09:00:00Z',
    updated_at: '2026-11-15T09:00:00Z',
    ...overrides,
  };
}

describe('application analytics', () => {
  it('maps tracker statuses onto the analytics stages', () => {
    expect(analyticsStageFor('tailored_queue')).toBe('draft');
    expect(analyticsStageFor('saved')).toBe('draft');
    expect(analyticsStageFor('applied')).toBe('sent');
    expect(analyticsStageFor('no_response')).toBe('sent');
    expect(analyticsStageFor('response')).toBe('screening');
    expect(analyticsStageFor('interview')).toBe('interview');
    expect(analyticsStageFor('accepted')).toBe('accepted');
    expect(analyticsStageFor('rejected')).toBe('rejected');
  });

  it('computes the funnel, waiting count and stage rollup', () => {
    const analytics = buildApplicationAnalytics(
      [
        card('a1', 'applied'),
        card('a2', 'no_response', { applied_at: '2026-11-01T09:00:00Z' }),
        card('a3', 'response'),
        card('a4', 'interview'),
        card('a5', 'accepted'),
        card('a6', 'rejected'),
        card('a7', 'tailored_queue'),
        card('a8', 'saved'),
      ],
      { range: 'all', now: NOW }
    );

    expect(analytics.sent).toBe(6);
    expect(analytics.heardBackRate).toBe(67);
    expect(analytics.reachedInterview).toBe(2);
    expect(analytics.waiting).toBe(2);
    expect(analytics.stages).toMatchObject({
      draft: 2,
      sent: 2,
      screening: 1,
      interview: 1,
      accepted: 1,
      rejected: 1,
      offer: 0,
      declined: 0,
    });
  });

  it('filters by range and buckets started/sent by week', () => {
    const applications = [
      card('in-30', 'applied', {
        created_at: '2026-11-02T09:00:00Z',
        applied_at: '2026-11-03T09:00:00Z',
      }),
      card('in-90', 'applied', {
        created_at: '2026-10-10T09:00:00Z',
        applied_at: '2026-10-11T09:00:00Z',
      }),
      card('old', 'applied', {
        created_at: '2026-01-01T09:00:00Z',
        applied_at: '2026-01-02T09:00:00Z',
      }),
    ];

    const thirty = buildApplicationAnalytics(applications, { range: '30d', now: NOW });
    expect(thirty.sent).toBe(1);
    expect(thirty.started).toBe(1);
    expect(thirty.weekly.at(-1)).toMatchObject({ weekStart: '2026-11-16', started: 0, sent: 0 });
    expect(thirty.weekly.some((week) => week.weekStart === '2026-11-02' && week.sent === 1)).toBe(
      true
    );

    const ninety = buildApplicationAnalytics(applications, { range: '90d', now: NOW });
    expect(ninety.sent).toBe(2);
    expect(ninety.started).toBe(2);
  });

  it('returns the inclusive start for each range', () => {
    expect(analyticsRangeStart('30d', NOW)?.toISOString()).toBe('2026-10-21T12:00:00.000Z');
    expect(analyticsRangeStart('90d', NOW)?.toISOString()).toBe('2026-08-22T12:00:00.000Z');
    expect(analyticsRangeStart('all', NOW)).toBeNull();
  });

  it('surfaces stale sent cards and drafts as worth a look', () => {
    const analytics = buildApplicationAnalytics(
      [
        card('stale', 'applied', { applied_at: '2026-11-01T09:00:00Z' }),
        card('fresh', 'applied', { applied_at: '2026-11-18T09:00:00Z' }),
        card('draft', 'tailored_queue', {
          applied_at: null,
          created_at: '2026-11-10T09:00:00Z',
        }),
      ],
      { range: 'all', now: NOW }
    );

    expect(analytics.worthAView).toHaveLength(3);
    expect(analytics.worthAView[0]).toMatchObject({ applicationId: 'stale', kind: 'followUp' });
    expect(analytics.worthAView[1]).toMatchObject({ applicationId: 'draft', kind: 'draft' });
    expect(analytics.worthAView[2]).toMatchObject({ applicationId: 'fresh', kind: 'waiting' });
  });

  it('handles an empty board without dividing by zero', () => {
    const analytics = buildApplicationAnalytics([], { range: '30d', now: NOW });
    expect(analytics.sent).toBe(0);
    expect(analytics.heardBackRate).toBe(0);
    expect(analytics.worthAView).toEqual([]);
    // Five Monday buckets cover a 30-day window ending on 20 Nov 2026.
    expect(analytics.weekly).toHaveLength(5);
  });
});
