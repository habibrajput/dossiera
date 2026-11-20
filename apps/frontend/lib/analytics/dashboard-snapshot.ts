import type { AnalyticsStage } from '@/lib/analytics/application-analytics';

export interface StageSnapshot {
  count: number;
  hintKey?: string;
  hintParams?: Record<string, string | number>;
}

export interface WeeklySnapshot {
  label: string;
  started: number;
  sent: number;
}

export interface WorthAViewSnapshot {
  id: string;
  company: string;
  role: string;
  hintKey: string;
  hintParams?: Record<string, string | number>;
  action: 'finish' | 'open';
}

export interface DashboardSnapshot {
  sent: number;
  heardBack: number;
  heardBackRate: number;
  reachedInterview: number;
  waiting: number;
  started: number;
  weekly: WeeklySnapshot[];
  stages: Record<AnalyticsStage, StageSnapshot>;
  worthAView: WorthAViewSnapshot[];
  followUpDays: number;
}

const STAGE_ORDER: AnalyticsStage[] = [
  'draft',
  'sent',
  'screening',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'declined',
];

function stageCounts(values: number[]): Record<AnalyticsStage, StageSnapshot> {
  return STAGE_ORDER.reduce(
    (acc, stage, index) => {
      const count = values[index] ?? 0;
      acc[stage] = {
        count,
        hintKey:
          count === 0
            ? stage === 'sent'
              ? 'analytics.stageSentHint'
              : 'analytics.stageEmpty'
            : stage === 'sent'
              ? 'analytics.stageSentHint'
              : undefined,
      };
      return acc;
    },
    {} as Record<AnalyticsStage, StageSnapshot>
  );
}

/**
 * The dashboard opens on a representative snapshot so the funnel, board and
 * follow-up hints read clearly before enough applications have been tracked.
 */
export const DASHBOARD_SNAPSHOT: DashboardSnapshot = {
  sent: 3,
  heardBack: 0,
  heardBackRate: 0,
  reachedInterview: 0,
  waiting: 3,
  started: 7,
  weekly: [
    { label: '2 Nov', started: 5, sent: 0 },
    { label: '9 Nov', started: 0, sent: 3 },
    { label: '16 Nov', started: 2, sent: 0 },
  ],
  stages: stageCounts([4, 3, 0, 0, 0, 0, 0, 0]),
  worthAView: [
    {
      id: 'mohkaab',
      company: 'Mohkaab Enterprise',
      role: 'PHP / Laravel Developer',
      hintKey: 'analytics.worthDeadlinePast',
      hintParams: { date: '2 Nov' },
      action: 'finish',
    },
    {
      id: 'who-and-co',
      company: 'WHO&Co.',
      role: 'Desarrollador/a Full-Stack',
      hintKey: 'analytics.worthDeadlineFuture',
      hintParams: { date: '4 Dec' },
      action: 'finish',
    },
    {
      id: 'turing',
      company: 'Turing.com',
      role: 'PHP Tech Lead',
      hintKey: 'analytics.worthDeadlineFuture',
      hintParams: { date: '12 Dec' },
      action: 'finish',
    },
    {
      id: 'cubixsol',
      company: 'Cubixsol',
      role: 'Senior Laravel Developer',
      hintKey: 'analytics.worthDraft',
      action: 'finish',
    },
    {
      id: 'invobyte',
      company: 'InvoByte',
      role: 'PHP Laravel Developer',
      hintKey: 'analytics.worthFollowUp',
      hintParams: { days: 18 },
      action: 'open',
    },
    {
      id: 'devstudio',
      company: 'DevStudio',
      role: 'Full Stack Developer - Laravel & React / Angular / Vue.js',
      hintKey: 'analytics.worthFollowUp',
      hintParams: { days: 18 },
      action: 'open',
    },
    {
      id: 'musharp',
      company: 'muSharp',
      role: 'Senior Full-Stack Engineer: Laravel + React',
      hintKey: 'analytics.worthFollowUp',
      hintParams: { days: 18 },
      action: 'open',
    },
  ],
  followUpDays: 7,
};
