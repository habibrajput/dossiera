'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import type { WeeklyBucket } from '@/lib/utils/application-analytics';
import { DashboardSection } from './dashboard-section';

interface WeeklyActivityProps {
  weekly: WeeklyBucket[];
  started: number;
  sent: number;
}

export function WeeklyActivity({ weekly, started, sent }: WeeklyActivityProps) {
  const { t, locale } = useTranslations();
  const [showNumbers, setShowNumbers] = useState(false);
  const maxValue = Math.max(1, ...weekly.flatMap((week) => [week.started, week.sent]));
  const formatWeek = (date: Date) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
  const summary = t('applicationDashboard.weeklySummary', { started, sent });

  return (
    <DashboardSection
      title={t('applicationDashboard.weeklyTitle')}
      description={summary}
      action={
        <Button type="button" size="sm" variant="outline" onClick={() => setShowNumbers((v) => !v)}>
          {showNumbers
            ? t('applicationDashboard.showChart')
            : t('applicationDashboard.showNumbers')}
        </Button>
      }
    >
      <div className="flex gap-6 font-mono text-xs uppercase text-ink-soft">
        <span className="flex items-center gap-2">
          <span className="size-3 border border-border bg-panel" aria-hidden="true" />
          {t('applicationDashboard.started')}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 bg-ink" aria-hidden="true" />
          {t('applicationDashboard.sent')}
        </span>
      </div>

      {showNumbers ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="border-b border-border font-mono text-xs uppercase">
                <th scope="col" className="py-2">
                  {t('applicationDashboard.week')}
                </th>
                <th scope="col" className="py-2 text-right">
                  {t('applicationDashboard.started')}
                </th>
                <th scope="col" className="py-2 text-right">
                  {t('applicationDashboard.sent')}
                </th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((week) => (
                <tr key={week.key} className="border-b border-panel">
                  <th scope="row" className="py-2 font-normal">
                    {formatWeek(week.startsAt)}
                  </th>
                  <td className="py-2 text-right tabular-nums">{week.started}</td>
                  <td className="py-2 text-right tabular-nums">{week.sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="mt-6 overflow-x-auto"
          role="img"
          aria-label={t('applicationDashboard.weeklyChartLabel', { started, sent })}
        >
          <div className="flex h-56 min-w-max items-end gap-4 border-b border-border px-1 pt-6">
            {weekly.map((week) => (
              <div
                key={week.key}
                className="flex w-16 flex-col items-center justify-end self-stretch"
              >
                <div className="flex h-full items-end justify-center gap-1" aria-hidden="true">
                  {[
                    { count: week.started, className: 'border border-border bg-panel' },
                    { count: week.sent, className: 'bg-ink' },
                  ].map((bar, index) => (
                    <div
                      key={index}
                      className={`w-5 ${bar.className}`}
                      style={{
                        height: `${bar.count ? Math.max((bar.count / maxValue) * 100, 3) : 0}%`,
                      }}
                      title={String(bar.count)}
                    />
                  ))}
                </div>
                <span className="mt-2 whitespace-nowrap pb-2 font-mono text-xs uppercase text-steel">
                  {formatWeek(week.startsAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardSection>
  );
}
