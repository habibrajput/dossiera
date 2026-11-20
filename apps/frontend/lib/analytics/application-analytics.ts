import type { Application, ApplicationStatus } from '@/lib/api/tracker';
import { daysSinceApplied } from '@/lib/tracker-follow-up';

/** The three period options exposed on the analytics dashboard. */
export type AnalyticsRange = '30d' | '90d' | 'all';

/** The stages shown in the analytics rollup (a superset of the tracker's own columns). */
export type AnalyticsStage =
  | 'draft'
  | 'sent'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'declined';

export const ANALYTICS_STAGES: AnalyticsStage[] = [
  'draft',
  'sent',
  'screening',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'declined',
];

export interface WeeklyCount {
  /** Monday of the ISO week, as an ISO date string. */
  weekStart: string;
  started: number;
  sent: number;
}

export interface WorthAViewItem {
  applicationId: string;
  company: string;
  role: string;
  kind: 'draft' | 'followUp' | 'waiting';
  daysWaiting: number | null;
}

export interface ApplicationAnalytics {
  sent: number;
  heardBackRate: number;
  reachedInterview: number;
  waiting: number;
  started: number;
  weekly: WeeklyCount[];
  stages: Record<AnalyticsStage, number>;
  worthAView: WorthAViewItem[];
}

export interface AnalyticsOptions {
  range: AnalyticsRange;
  now: Date;
  followUpDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SENT_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'applied',
  'no_response',
  'response',
  'interview',
  'accepted',
  'rejected',
]);
const HEARD_BACK_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'response',
  'interview',
  'accepted',
  'rejected',
]);
const INTERVIEW_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['interview', 'accepted']);
const WAITING_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['applied', 'no_response']);
const DRAFT_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['tailored_queue', 'saved']);

/** Inclusive lower bound for a range, or null for all time. */
export function analyticsRangeStart(range: AnalyticsRange, now: Date): Date | null {
  if (range === 'all') return null;
  const days = range === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * DAY_MS);
}

function inRange(value: string | null, start: Date | null, now: Date): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  return time >= (start?.getTime() ?? Number.NEGATIVE_INFINITY) && time <= now.getTime();
}

function startOfWeek(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  // getDay() is Sunday-based; shift so Monday starts the week.
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

/** Local calendar date as YYYY-MM-DD (toISOString would shift the day east of UTC). */
function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyStages(): Record<AnalyticsStage, number> {
  return ANALYTICS_STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage]: 0 }),
    {} as Record<AnalyticsStage, number>
  );
}

/** Map a tracker status onto the analytics board's vocabulary. */
export function analyticsStageFor(status: ApplicationStatus): AnalyticsStage {
  if (DRAFT_STATUSES.has(status)) return 'draft';
  if (status === 'applied' || status === 'no_response') return 'sent';
  if (status === 'response') return 'screening';
  if (status === 'interview') return 'interview';
  if (status === 'accepted') return 'accepted';
  if (status === 'rejected') return 'rejected';
  // `offer` and `declined` are analytics-only stages; the tracker has no
  // equivalent columns yet, so their counters stay at zero.
  return 'sent';
}

function buildWeekly(applications: Application[], start: Date | null, now: Date): WeeklyCount[] {
  const dated = applications.flatMap((application) => {
    const values: Date[] = [];
    const created = Date.parse(application.created_at);
    if (!Number.isNaN(created)) values.push(new Date(created));
    if (application.applied_at) {
      const applied = Date.parse(application.applied_at);
      if (!Number.isNaN(applied)) values.push(new Date(applied));
    }
    return values;
  });
  const earliest = dated.length > 0 ? new Date(Math.min(...dated.map((d) => d.getTime()))) : now;
  const firstWeek = startOfWeek(start && earliest > start ? start : earliest);
  const lastWeek = startOfWeek(now);
  const buckets = new Map<string, WeeklyCount>();
  for (
    let cursor = firstWeek;
    cursor.getTime() <= lastWeek.getTime();
    cursor = new Date(cursor.getTime() + 7 * DAY_MS)
  ) {
    const weekStart = toDateKey(cursor);
    buckets.set(weekStart, { weekStart, started: 0, sent: 0 });
  }

  const increment = (value: string | null, key: 'started' | 'sent') => {
    const time = value ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(time)) return;
    const bucket = buckets.get(toDateKey(startOfWeek(new Date(time))));
    if (bucket) bucket[key] += 1;
  };

  for (const application of applications) {
    if (inRange(application.created_at, start, now)) increment(application.created_at, 'started');
    if (SENT_STATUSES.has(application.status) && inRange(application.applied_at, start, now)) {
      increment(application.applied_at, 'sent');
    }
  }
  return [...buckets.values()];
}

/**
 * Derive every number on the analytics dashboard from tracker cards.
 * Pure so the UI can switch ranges without another backend call.
 */
export function buildApplicationAnalytics(
  applications: Application[],
  { range, now, followUpDays = 7 }: AnalyticsOptions
): ApplicationAnalytics {
  const start = analyticsRangeStart(range, now);
  const scoped = applications.filter((application) =>
    inRange(application.applied_at ?? application.created_at, start, now)
  );
  const stages = emptyStages();
  const weekly = buildWeekly(applications, start, now);
  const worthAView: WorthAViewItem[] = [];
  let sent = 0;
  let heardBack = 0;
  let reachedInterview = 0;
  let waiting = 0;
  let started = 0;

  for (const application of scoped) {
    stages[analyticsStageFor(application.status)] += 1;
    if (inRange(application.created_at, start, now)) started += 1;

    if (!SENT_STATUSES.has(application.status)) continue;
    sent += 1;
    if (HEARD_BACK_STATUSES.has(application.status)) heardBack += 1;
    if (INTERVIEW_STATUSES.has(application.status)) reachedInterview += 1;

    if (WAITING_STATUSES.has(application.status)) {
      waiting += 1;
      const days = daysSinceApplied(application.applied_at, now);
      worthAView.push({
        applicationId: application.application_id,
        company: application.company || '—',
        role: application.role || '—',
        kind: days !== null && days >= followUpDays ? 'followUp' : 'waiting',
        daysWaiting: days,
      });
    }
  }

  for (const application of scoped) {
    if (!DRAFT_STATUSES.has(application.status)) continue;
    worthAView.push({
      applicationId: application.application_id,
      company: application.company || '—',
      role: application.role || '—',
      kind: 'draft',
      daysWaiting: daysSinceApplied(application.created_at, now),
    });
  }

  worthAView.sort((a, b) => {
    if (a.kind !== b.kind) {
      const order: Record<WorthAViewItem['kind'], number> = { followUp: 0, draft: 1, waiting: 2 };
      return order[a.kind] - order[b.kind];
    }
    return (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0);
  });

  return {
    sent,
    heardBackRate: sent === 0 ? 0 : Math.round((heardBack / sent) * 100),
    reachedInterview,
    waiting,
    started,
    weekly,
    stages,
    worthAView: worthAView.slice(0, 7),
  };
}
