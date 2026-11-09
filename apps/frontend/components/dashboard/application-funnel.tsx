'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import type { DashboardAnalytics } from '@/lib/utils/application-analytics';
import { DashboardSection } from './dashboard-section';

export function ApplicationFunnel({ analytics }: { analytics: DashboardAnalytics }) {
  const { t } = useTranslations();
  const [showNumbers, setShowNumbers] = useState(false);
  const sent = analytics.sent.length;
  const heardBackRate = sent ? Math.round((analytics.heardBack / sent) * 100) : 0;
  const stages = [
    { key: 'sent', label: t('applicationDashboard.sent'), count: sent },
    { key: 'screening', label: t('applicationDashboard.screening'), count: analytics.heardBack },
    {
      key: 'interview',
      label: t('applicationDashboard.interview'),
      count: analytics.reachedInterview,
    },
    { key: 'offer', label: t('applicationDashboard.offer'), count: analytics.offers },
    { key: 'accepted', label: t('applicationDashboard.accepted'), count: analytics.accepted },
  ];

  return (
    <DashboardSection
      title={t('applicationDashboard.funnelTitle')}
      description={t('applicationDashboard.funnelDescription')}
      action={
        <Button type="button" size="sm" variant="outline" onClick={() => setShowNumbers((v) => !v)}>
          {showNumbers
            ? t('applicationDashboard.showChart')
            : t('applicationDashboard.showNumbers')}
        </Button>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-ink border-y border-ink text-center">
        <div className="p-3">
          <p className="font-mono text-xs uppercase text-steel">{t('applicationDashboard.sent')}</p>
          <p className="mt-1 font-serif text-3xl font-bold text-ink">{sent}</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-xs uppercase text-steel">
            {t('applicationDashboard.heardBack')}
          </p>
          <p className="mt-1 font-serif text-3xl font-bold text-ink">{heardBackRate}%</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-xs uppercase text-steel">
            {t('applicationDashboard.reachedInterview')}
          </p>
          <p className="mt-1 font-serif text-3xl font-bold text-ink">
            {analytics.reachedInterview}
          </p>
        </div>
      </div>

      {showNumbers ? (
        <table className="mt-6 w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t('applicationDashboard.funnelTitle')}</caption>
          <thead>
            <tr className="border-b border-ink font-mono text-xs uppercase">
              <th scope="col" className="py-2">
                {t('applicationDashboard.stage')}
              </th>
              <th scope="col" className="py-2 text-right">
                {t('applicationDashboard.count')}
              </th>
              <th scope="col" className="py-2 text-right">
                {t('applicationDashboard.percentage')}
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.key} className="border-b border-panel">
                <th scope="row" className="py-2 font-normal">
                  {stage.label}
                </th>
                <td className="py-2 text-right tabular-nums">{stage.count}</td>
                <td className="py-2 text-right tabular-nums">
                  {sent ? Math.round((stage.count / sent) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-6 space-y-4">
          {stages.map((stage) => {
            const percentage = sent ? (stage.count / sent) * 100 : 0;
            return (
              <div key={stage.key}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs uppercase text-ink-soft">{stage.label}</span>
                  <span className="font-serif text-2xl font-bold tabular-nums text-ink">
                    {stage.count}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-panel" aria-hidden="true">
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${stage.count ? Math.max(percentage, 2) : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 font-mono text-xs uppercase text-steel">
        {t('applicationDashboard.waiting', { count: analytics.waiting })}
      </p>
    </DashboardSection>
  );
}
