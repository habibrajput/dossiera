import {
  APPLICATION_STATUS_ORDER,
  type Application,
  type ApplicationColumns,
  type ApplicationStatus,
} from '@/lib/api/tracker';
import { safeStorage } from '@/lib/utils/resume-draft-storage';

export type DashboardPeriod = '30' | '90' | 'all';
export type DashboardStatus =
  | 'saved'
  | 'applied'
  | 'response'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'declined';

export interface WeeklyBucket {
  key: string;
  startsAt: Date;
  started: number;
  sent: number;
}

export interface DashboardAnalytics {
  started: Application[];
  sent: Application[];
  heardBack: number;
  reachedInterview: number;
  offers: number;
  accepted: number;
  waiting: number;
  statusCounts: Record<DashboardStatus, number>;
  weekly: WeeklyBucket[];
}

export interface AttentionItem {
  application: Application;
  kind: 'deadline' | 'follow_up';
  date: Date;
  days: number;
}

export interface ApplicationCalendarEvent {
  id: string;
  application: Application;
  kind: 'deadline' | 'sent';
  date: Date;
  key: string;
}

const DAY_MS = 86_400_000;
const HEARD_BACK = new Set<ApplicationStatus>([
  'response',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'declined',
]);
const INTERVIEW = new Set<ApplicationStatus>(['interview', 'offer', 'accepted']);
const OFFER = new Set<ApplicationStatus>(['offer', 'accepted']);
const WAITING = new Set<ApplicationStatus>([
  'applied',
  'no_response',
  'response',
  'interview',
  'offer',
]);
const FOLLOW_UP_STORAGE_KEY = 'application_dashboard_follow_up_days';
export const DEFAULT_FOLLOW_UP_DAYS = 7;

export function flattenApplications(columns: ApplicationColumns): Application[] {
  return APPLICATION_STATUS_ORDER.flatMap((status) => columns[status] ?? []);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}

export function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sentDate(application: Application): Date | null {
  return (
    parseDate(application.applied_at) ??
    (application.status !== 'saved' ? parseDate(application.created_at) : null)
  );
}

function withinPeriod(date: Date | null, start: Date | null, now: Date): boolean {
  if (!date) return false;
  return (!start || date >= start) && date <= now;
}

function earliestActivity(applications: Application[]): Date | null {
  const dates = applications.flatMap((application) =>
    [parseDate(application.created_at), sentDate(application)].filter((date): date is Date =>
      Boolean(date)
    )
  );
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function getDashboardAnalytics(
  applications: Application[],
  period: DashboardPeriod,
  now: Date
): DashboardAnalytics {
  const periodStart =
    period === 'all' ? null : addDays(startOfDay(now), period === '30' ? -29 : -89);
  const started = applications.filter((application) =>
    withinPeriod(parseDate(application.created_at), periodStart, now)
  );
  const sent = applications.filter((application) =>
    withinPeriod(sentDate(application), periodStart, now)
  );
  const heardBack = sent.filter(
    (application) => application.heard_back_at || HEARD_BACK.has(application.status)
  ).length;
  const reachedInterview = sent.filter(
    (application) =>
      application.interview_at || application.offer_at || INTERVIEW.has(application.status)
  ).length;
  const offers = sent.filter(
    (application) => application.offer_at || OFFER.has(application.status)
  ).length;
  const statusCounts: Record<DashboardStatus, number> = {
    saved: 0,
    applied: 0,
    response: 0,
    interview: 0,
    offer: 0,
    accepted: 0,
    rejected: 0,
    declined: 0,
  };
  for (const application of applications) {
    if (application.status === 'no_response') statusCounts.applied += 1;
    else if (application.status in statusCounts) {
      statusCounts[application.status as DashboardStatus] += 1;
    }
  }

  const firstActivity = periodStart ?? earliestActivity(applications) ?? now;
  const firstWeek = startOfWeek(firstActivity);
  const currentWeek = startOfWeek(now);
  const weekly: WeeklyBucket[] = [];
  for (
    let week = firstWeek, count = 0;
    week <= currentWeek && count < 520;
    week = addDays(week, 7), count += 1
  ) {
    const nextWeek = addDays(week, 7);
    weekly.push({
      key: dateKey(week),
      startsAt: week,
      started: started.filter((application) => {
        const date = parseDate(application.created_at);
        return date && date >= week && date < nextWeek;
      }).length,
      sent: sent.filter((application) => {
        const date = sentDate(application);
        return date && date >= week && date < nextWeek;
      }).length,
    });
  }

  return {
    started,
    sent,
    heardBack,
    reachedInterview,
    offers,
    accepted: sent.filter((application) => application.status === 'accepted').length,
    waiting: sent.filter((application) => WAITING.has(application.status)).length,
    statusCounts,
    weekly,
  };
}

export function getAttentionItems(
  applications: Application[],
  now: Date,
  followUpDays: number
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const application of applications) {
    const deadline = parseDate(application.deadline_at);
    if (application.status === 'saved' && deadline) {
      const daysUntil = daysBetween(deadline, now);
      if (daysUntil <= 14) {
        items.push({ application, kind: 'deadline', date: deadline, days: -daysUntil });
      }
    }
    if (WAITING.has(application.status)) {
      const lastActivity = parseDate(
        application.status_changed_at ??
          application.updated_at ??
          application.applied_at ??
          application.created_at
      );
      const quietDays = lastActivity ? daysBetween(now, lastActivity) : 0;
      if (lastActivity && quietDays >= followUpDays) {
        items.push({ application, kind: 'follow_up', date: lastActivity, days: quietDays });
      }
    }
  }
  return items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'deadline' ? -1 : 1;
    return a.kind === 'deadline' ? a.date.getTime() - b.date.getTime() : b.days - a.days;
  });
}

export function getCalendarEvents(applications: Application[]): ApplicationCalendarEvent[] {
  return applications.flatMap((application) => {
    const events: ApplicationCalendarEvent[] = [];
    const deadline = parseDate(application.deadline_at);
    if (deadline && (application.status === 'saved' || WAITING.has(application.status))) {
      events.push({
        id: `${application.application_id}-deadline`,
        application,
        kind: 'deadline',
        date: deadline,
        key: dateKey(deadline),
      });
    }
    const sent = sentDate(application);
    if (sent) {
      events.push({
        id: `${application.application_id}-sent`,
        application,
        kind: 'sent',
        date: sent,
        key: dateKey(sent),
      });
    }
    return events;
  });
}

export interface CalendarDay {
  date: Date;
  key: string;
  day: number;
  inMonth: boolean;
}

export function buildCalendarDays(month: Date): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      key: dateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export function getGoogleCalendarUrl(event: ApplicationCalendarEvent, title: string): string {
  const end = addDays(event.date, 1);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dateKey(event.date).replaceAll('-', '')}/${dateKey(end).replaceAll('-', '')}`,
    details: [event.application.company, event.application.role].filter(Boolean).join(' — '),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function readFollowUpDays(): number {
  if (typeof window === 'undefined') return DEFAULT_FOLLOW_UP_DAYS;
  const stored = Number(safeStorage.get(FOLLOW_UP_STORAGE_KEY));
  return Number.isInteger(stored) && stored >= 1 && stored <= 90 ? stored : DEFAULT_FOLLOW_UP_DAYS;
}

export function writeFollowUpDays(value: number): void {
  if (Number.isInteger(value) && value >= 1 && value <= 90) {
    safeStorage.set(FOLLOW_UP_STORAGE_KEY, String(value));
  }
}
