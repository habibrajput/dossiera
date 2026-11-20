'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from '@phosphor-icons/react';
import { PageFrame } from '@/components/ui/page-frame';
import { PanelHeader } from '@/components/ui/panel-header';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ManualAddApplicationDialog } from '@/components/tracker/manual-add-application-dialog';
import { useTranslations } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { ANALYTICS_STAGES, type AnalyticsRange } from '@/lib/analytics/application-analytics';
import { DASHBOARD_SNAPSHOT, type WorthAViewSnapshot } from '@/lib/analytics/dashboard-snapshot';

const PROFILE_NAME_KEY = 'rm.profileName';
const DEFAULT_PROFILE_NAME = 'Habib';
const CALENDAR_MONTH = new Date(2026, 10, 1);
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function percent(value: number, max: number): number {
  return max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
}

export default function AnalyticsDashboardPage() {
  const { t, locale } = useTranslations();
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [showFunnelNumbers, setShowFunnelNumbers] = useState(false);
  const [showWeekNumbers, setShowWeekNumbers] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(DASHBOARD_SNAPSHOT.followUpDays);
  const [addOpen, setAddOpen] = useState(false);
  const [profileName, setProfileName] = useState(DEFAULT_PROFILE_NAME);

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_NAME_KEY);
    if (stored?.trim()) setProfileName(stored.trim());
  }, []);

  const snapshot = DASHBOARD_SNAPSHOT;
  const stageMax = Math.max(1, ...ANALYTICS_STAGES.map((stage) => snapshot.stages[stage].count));
  const chartMax = Math.max(1, ...snapshot.weekly.map((week) => Math.max(week.started, week.sent)));

  const calendar = useMemo(() => {
    const offset = (CALENDAR_MONTH.getDay() + 6) % 7;
    const gridStart = new Date(CALENDAR_MONTH);
    gridStart.setDate(CALENDAR_MONTH.getDate() - offset);
    return {
      title: formatDate(CALENDAR_MONTH, locale, { month: 'long', year: 'numeric' }),
      days: Array.from({ length: 42 }, (_, index) => {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + index);
        return {
          key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
          label: day.getDate(),
          outside: day.getMonth() !== CALENDAR_MONTH.getMonth(),
        };
      }),
    };
  }, [locale]);

  const renderWorthItem = (item: WorthAViewSnapshot) => (
    <li key={item.id} className="border-b border-ink py-3 last:border-b-0">
      <Link
        href="/tracker"
        className="group flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span className="font-serif text-sm font-bold text-ink group-hover:text-primary">
          {item.company}, {item.role}
        </span>
        <span className="font-mono text-xs text-steel">{t(item.hintKey, item.hintParams)}</span>
        <span className="font-mono text-xs font-bold uppercase text-primary">
          {item.action === 'finish' ? t('analytics.finish') : t('analytics.open')}
        </span>
      </Link>
    </li>
  );

  return (
    <PageFrame width="default">
      <header className="flex flex-col gap-4 border-b border-ink bg-white px-6 py-8 md:flex-row md:items-start md:justify-between md:px-8">
        <div>
          <h1 className="font-serif text-3xl font-bold uppercase leading-none tracking-tight text-ink md:text-4xl">
            {t('analytics.greetingAfternoon', { name: profileName })}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-ink-soft">
            {t('analytics.summary', {
              sent: snapshot.sent,
              heardBack: snapshot.heardBack,
            })}
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          {t('analytics.newApplication')}
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-6 py-4 md:px-8">
        <span className="font-mono text-xs font-bold uppercase tracking-wide text-steel">
          {t('analytics.showing')}
        </span>
        <SegmentedControl
          aria-label={t('analytics.showing')}
          size="sm"
          value={range}
          onChange={setRange}
          items={[
            { value: '30d', label: t('analytics.range30') },
            { value: '90d', label: t('analytics.range90') },
            { value: 'all', label: t('analytics.rangeAll') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 md:p-8 xl:grid-cols-12">
        <Card variant="raised" className="xl:col-span-8">
          <PanelHeader tone="input" title={t('analytics.funnelTitle')}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowFunnelNumbers((shown) => !shown)}
            >
              {showFunnelNumbers ? t('analytics.hideNumbers') : t('analytics.showNumbers')}
            </Button>
          </PanelHeader>
          <p className="text-sm text-ink-soft">{t('analytics.funnelDescription')}</p>

          <div className="mt-4 grid grid-cols-3 gap-4 border-b border-ink pb-4">
            <div>
              <p className="font-mono text-xs uppercase text-steel">{t('analytics.sent')}</p>
              <p className="font-serif text-3xl font-bold text-ink">{snapshot.sent}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-steel">{t('analytics.heardBack')}</p>
              <p className="font-serif text-3xl font-bold text-ink">{snapshot.heardBackRate}%</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-steel">
                {t('analytics.reachedInterview')}
              </p>
              <p className="font-serif text-3xl font-bold text-ink">{snapshot.reachedInterview}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {ANALYTICS_STAGES.map((stage, index) => {
              const current = snapshot.stages[stage];
              return (
                <li key={stage}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-bold uppercase text-ink">
                      {t(`analytics.stage.${stage}`)}
                    </span>
                    <span className="font-mono text-xs font-bold text-ink tabular-nums">
                      {current.count}
                    </span>
                  </div>
                  <div className="h-3 border border-ink bg-canvas">
                    <div
                      className={cn(
                        'h-full',
                        index === 0 ? 'bg-ink' : index === 1 ? 'bg-primary' : 'bg-success'
                      )}
                      style={{ width: `${percent(current.count, stageMax)}%` }}
                    />
                  </div>
                  {current.hintKey && (
                    <p className="mt-1 font-mono text-xs text-steel">
                      {t(current.hintKey, current.hintParams)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {showFunnelNumbers && (
            <p className="mt-4 border-t border-ink pt-4 font-mono text-xs uppercase text-steel">
              {ANALYTICS_STAGES.map(
                (stage) => t(`analytics.stage.${stage}`) + ': ' + snapshot.stages[stage].count
              ).join('  /  ')}
            </p>
          )}

          <p className="mt-4 font-mono text-xs font-bold uppercase text-primary">
            {t('analytics.waiting', { count: snapshot.waiting })}
          </p>
        </Card>

        <Card variant="raised" className="xl:col-span-4">
          <PanelHeader tone="output" title={t('analytics.weeklyTitle')}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowWeekNumbers((shown) => !shown)}
            >
              {showWeekNumbers ? t('analytics.hideNumbers') : t('analytics.showNumbers')}
            </Button>
          </PanelHeader>
          <p className="text-sm text-ink-soft">
            {t('analytics.weeklySummary', {
              started: snapshot.started,
              sent: snapshot.sent,
            })}
          </p>
          <div className="mt-4 flex h-24 items-end gap-2 border-b border-l border-ink pb-2 pl-2">
            {snapshot.weekly.map((week) => (
              <div
                key={week.label}
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
              >
                <div className="flex h-full items-end gap-1">
                  <div
                    className="min-h-1 flex-1 bg-ink"
                    style={{ height: `${percent(week.started, chartMax)}%` }}
                    title={`${t('analytics.started')}: ${week.started}`}
                  />
                  <div
                    className="min-h-1 flex-1 bg-primary"
                    style={{ height: `${percent(week.sent, chartMax)}%` }}
                    title={`${t('analytics.weeklySent')}: ${week.sent}`}
                  />
                </div>
                <span className="truncate font-mono text-xs text-steel">{week.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 font-mono text-xs uppercase text-steel">
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="size-3 bg-ink" />
              {t('analytics.started')}
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="size-3 bg-primary" />
              {t('analytics.weeklySent')}
            </span>
          </div>
          {showWeekNumbers && (
            <ul className="mt-4 space-y-1 border-t border-ink pt-4">
              {snapshot.weekly.map((week) => (
                <li
                  key={week.label}
                  className="flex justify-between font-mono text-xs text-ink-soft"
                >
                  <span>{week.label}</span>
                  <span className="tabular-nums">
                    {t('analytics.started')} {week.started} / {t('analytics.weeklySent')}{' '}
                    {week.sent}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card variant="raised" className="xl:col-span-4">
          <PanelHeader tone="neutral" title={t('analytics.whereTitle')}>
            <Link href="/tracker" className={buttonClass({ variant: 'outline', size: 'sm' })}>
              {t('analytics.openBoard')}
            </Link>
          </PanelHeader>
          <ul className="divide-y divide-ink border-y border-ink">
            {ANALYTICS_STAGES.map((stage) => (
              <li key={stage} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs uppercase text-ink-soft">
                  {t(`analytics.stage.${stage}`)}
                </span>
                <span className="font-mono text-sm font-bold text-ink tabular-nums">
                  {snapshot.stages[stage].count}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="raised" className="xl:col-span-5">
          <PanelHeader tone="input" title={t('analytics.worthTitle')}>
            <span className="font-mono text-xs uppercase text-steel">
              {t('analytics.worthCount', { count: snapshot.worthAView.length })}
            </span>
          </PanelHeader>
          <ul>{snapshot.worthAView.map(renderWorthItem)}</ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink pt-4">
            <span className="font-mono text-xs text-ink-soft">
              {t('analytics.suggestFollowUp')}
            </span>
            <SegmentedControl
              aria-label={t('analytics.suggestFollowUp')}
              size="sm"
              value={String(followUpDays)}
              onChange={(value) => setFollowUpDays(Number(value))}
              items={[
                { value: '7', label: '7' },
                { value: '14', label: '14' },
                { value: '21', label: '21' },
              ]}
            />
            <span className="font-mono text-xs text-steel">{t('analytics.daysWithoutNews')}</span>
          </div>
        </Card>

        <Card variant="raised" className="xl:col-span-3">
          <PanelHeader tone="neutral" title={t('analytics.calendarTitle')} />
          <p className="font-serif text-lg font-bold text-ink">{calendar.title}</p>
          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="text-center font-mono text-xs font-bold uppercase text-steel"
              >
                {t(`analytics.weekday.${day}`)}
              </span>
            ))}
            {calendar.days.map((day) => (
              <span
                key={day.key}
                className={cn(
                  'flex size-8 items-center justify-center font-mono text-xs tabular-nums',
                  day.outside && 'text-steel'
                )}
              >
                {day.label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">{t('analytics.calendarEmpty')}</p>
          <p className="mt-1 font-mono text-xs text-steel">
            {t('analytics.calendarTimezone', { timeZone: 'Asia/Karachi' })}
          </p>
        </Card>
      </div>

      <ManualAddApplicationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => setAddOpen(false)}
      />
    </PageFrame>
  );
}
