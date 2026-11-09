import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Application, ApplicationColumns } from '@/lib/api/tracker';
import {
  DEFAULT_FOLLOW_UP_DAYS,
  buildCalendarDays,
  dateKey,
  flattenApplications,
  getAttentionItems,
  getCalendarEvents,
  getDashboardAnalytics,
  getGoogleCalendarUrl,
  readFollowUpDays,
  writeFollowUpDays,
} from '@/lib/utils/application-analytics';

const now = new Date(2026, 10, 9, 23, 59); // Monday 9 Nov 2026, end of local day.

function application(
  status: Application['status'],
  overrides: Partial<Application> = {}
): Application {
  return {
    application_id: 'app-1',
    job_id: 'job-1',
    resume_id: 'resume-1',
    master_resume_id: null,
    status,
    company: 'Acme',
    role: 'Engineer',
    applied_at: '2026-11-03T10:30:00Z',
    notes: null,
    position: 0,
    created_at: '2026-11-02T10:30:00Z',
    updated_at: '2026-11-03T10:30:00Z',
    ...overrides,
  };
}

function columns(cards: Application[]): ApplicationColumns {
  const columns = Object.fromEntries(
    Object.entries({
      saved: [],
      applied: [],
      no_response: [],
      response: [],
      interview: [],
      offer: [],
      accepted: [],
      rejected: [],
      declined: [],
    })
  ) as ApplicationColumns;
  for (const card of cards) columns[card.status].push(card);
  return columns;
}

function localISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('application dashboard analytics', () => {
  it('flattens the statuses returned by the API', () => {
    const cards = [
      application('saved', { status: 'saved' as const }),
      application('applied'),
      application('declined', { application_id: 'app-2', status: 'declined' as const }),
    ];
    expect(flattenApplications(columns(cards)).map((card) => card.application_id)).toEqual([
      'app-1',
      'app-1',
      'app-2',
    ]);
  });

  it('counts started and sent applications only inside the selected period', () => {
    const cards = [
      application('applied', { application_id: 'recent' }),
      application('applied', {
        application_id: 'older-than-30',
        created_at: '2026-09-01T10:00:00Z',
        applied_at: '2026-09-02T10:00:00Z',
      }),
      application('saved', { application_id: 'draft', applied_at: null }),
    ];

    const last30 = getDashboardAnalytics(cards, '30', now);
    expect(last30.started.map((card) => card.application_id)).toEqual(['recent', 'draft']);
    expect(last30.sent.map((card) => card.application_id)).toEqual(['recent']);

    const last90 = getDashboardAnalytics(cards, '90', now);
    expect(last90.started).toHaveLength(3);
    expect(last90.sent.map((card) => card.application_id)).toEqual(['recent', 'older-than-30']);

    const allTime = getDashboardAnalytics(cards, 'all', now);
    expect(allTime.started).toHaveLength(3);
    expect(allTime.sent.map((card) => card.application_id)).toEqual(['recent', 'older-than-30']);
  });

  it('uses milestone timestamps and falls back to the current stage for older rows', () => {
    const cards = [
      application('applied'),
      application('response', {
        application_id: 'response',
        heard_back_at: '2026-11-04T10:00:00Z',
      }),
      application('interview', {
        application_id: 'interview',
        heard_back_at: null,
        interview_at: '2026-11-05T10:00:00Z',
      }),
      application('offer', {
        application_id: 'offer',
        offer_at: '2026-11-06T10:00:00Z',
      }),
      application('accepted', {
        application_id: 'accepted',
        heard_back_at: null,
        interview_at: null,
        offer_at: null,
      }),
      application('declined', {
        application_id: 'declined',
        offer_at: '2026-11-07T10:00:00Z',
      }),
      application('rejected', {
        application_id: 'rejected',
        heard_back_at: null,
      }),
    ];
    const analytics = getDashboardAnalytics(cards, '30', now);

    expect(analytics.sent).toHaveLength(7);
    expect(analytics.heardBack).toBe(6);
    expect(analytics.reachedInterview).toBe(4);
    expect(analytics.offers).toBe(3);
    expect(analytics.accepted).toBe(1);
    expect(analytics.waiting).toBe(4);
  });

  it('rolls no response into the visible Sent snapshot and exposes all stages', () => {
    const cards = [
      application('saved', { applied_at: null }),
      application('applied', { application_id: 'applied' }),
      application('no_response', { application_id: 'no-response' }),
      application('response', { application_id: 'response', status: 'response' as const }),
      application('interview', { application_id: 'interview', status: 'interview' as const }),
      application('offer', { application_id: 'offer', status: 'offer' as const }),
      application('accepted', { application_id: 'accepted', status: 'accepted' as const }),
      application('rejected', { application_id: 'rejected', status: 'rejected' as const }),
      application('declined', { application_id: 'declined', status: 'declined' as const }),
    ];
    expect(getDashboardAnalytics(cards, '30', now).statusCounts).toEqual({
      saved: 1,
      applied: 2,
      response: 1,
      interview: 1,
      offer: 1,
      accepted: 1,
      rejected: 1,
      declined: 1,
    });
  });

  it('buckets weekly activity from Monday to Sunday', () => {
    const cards = [
      application('saved', {
        application_id: 'started-last-week',
        applied_at: null,
        created_at: '2026-11-03T12:00:00Z',
      }),
      application('applied', {
        application_id: 'sent-this-week',
        created_at: '2026-11-09T09:00:00Z',
        applied_at: '2026-11-09T09:30:00Z',
      }),
      application('applied', {
        application_id: 'sent-last-week',
        created_at: '2026-11-04T09:00:00Z',
        applied_at: '2026-11-05T09:30:00Z',
      }),
    ];
    const { weekly } = getDashboardAnalytics(cards, '30', now);
    const lastTwo = weekly.slice(-2);
    expect(lastTwo.map((week) => week.key)).toEqual(['2026-11-02', '2026-11-09']);
    expect(lastTwo[0]).toMatchObject({ started: 2, sent: 1 });
    expect(lastTwo[1]).toMatchObject({ started: 1, sent: 1 });
  });

  it('flags imminent and overdue drafts plus quiet live applications', () => {
    const cards = [
      application('saved', {
        application_id: 'overdue-draft',
        deadline_at: '2026-11-02',
      }),
      application('saved', {
        application_id: 'upcoming-draft',
        deadline_at: '2026-11-15',
      }),
      application('saved', {
        application_id: 'far-draft',
        deadline_at: '2026-12-20',
      }),
      application('no_response', {
        application_id: 'quiet-application',
        updated_at: '2026-11-01T10:00:00Z',
      }),
      application('no_response', {
        application_id: 'fresh-application',
        updated_at: '2026-11-08T10:00:00Z',
      }),
      application('accepted', { application_id: 'closed-application' }),
    ];

    const items = getAttentionItems(cards, now, 7);
    expect(items.map((item) => item.application.application_id)).toEqual([
      'overdue-draft',
      'upcoming-draft',
      'quiet-application',
    ]);
    expect(items[0]).toMatchObject({ kind: 'deadline', days: 7 });
    expect(items[1]).toMatchObject({ kind: 'deadline', days: -6 });
    expect(items[2]).toMatchObject({ kind: 'follow_up', days: 8 });
  });

  it('builds real deadline and sent calendar events', () => {
    const cards = [
      application('saved', {
        application_id: 'draft',
        applied_at: null,
        deadline_at: '2026-11-11',
      }),
      application('applied', { application_id: 'sent' }),
      application('rejected', {
        application_id: 'closed',
        deadline_at: '2026-11-12',
      }),
    ];
    const events = getCalendarEvents(cards);
    expect(events.map((event) => event.id)).toEqual(['draft-deadline', 'sent-sent', 'closed-sent']);
    expect(events[0]).toMatchObject({ kind: 'deadline', key: '2026-11-11' });
    expect(events[1]).toMatchObject({ kind: 'sent', key: '2026-11-03' });
  });

  it('builds a Monday-first six-week grid', () => {
    const days = buildCalendarDays(new Date(2026, 10, 9));
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ key: '2026-10-26', inMonth: false });
    expect(days[14]).toMatchObject({ key: '2026-11-09', inMonth: true });
    expect(days[41]).toMatchObject({ key: '2026-12-06', inMonth: false });
  });

  it('creates an all-day Google Calendar link for deadlines', () => {
    const [event] = getCalendarEvents([
      application('saved', {
        applied_at: null,
        deadline_at: '2026-11-11',
        company: 'Acme',
        role: 'Engineer',
      }),
    ]);
    const url = new URL(getGoogleCalendarUrl(event, 'Acme deadline'));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Acme deadline');
    expect(url.searchParams.get('dates')).toBe('20261111/20261112');
    expect(url.searchParams.get('details')).toBe('Acme — Engineer');
  });
});

describe('follow-up preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to seven days', () => {
    expect(readFollowUpDays()).toBe(DEFAULT_FOLLOW_UP_DAYS);
  });

  it('persists and clamps valid values', () => {
    writeFollowUpDays(14);
    expect(readFollowUpDays()).toBe(14);
    writeFollowUpDays(0);
    writeFollowUpDays(91);
    expect(readFollowUpDays()).toBe(14);
  });

  it('exposes a local YYYY-MM-DD key', () => {
    expect(dateKey(new Date(2026, 10, 9))).toBe(localISO(new Date(2026, 10, 9)));
  });
});
