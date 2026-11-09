'use client';

import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { buttonClass } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import type { DashboardStatus } from '@/lib/utils/application-analytics';
import { DashboardSection } from './dashboard-section';

const STATUS_ORDER: DashboardStatus[] = [
  'saved',
  'applied',
  'response',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'declined',
];

export function StatusOverview({ counts }: { counts: Record<DashboardStatus, number> }) {
  const { t } = useTranslations();

  return (
    <DashboardSection
      title={t('applicationDashboard.statusTitle')}
      action={
        <Link href="/tracker" className={buttonClass({ variant: 'outline', size: 'sm' })}>
          {t('applicationDashboard.openBoard')}
          <ArrowRight aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 border-l border-t border-ink sm:grid-cols-4 lg:grid-cols-8">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            data-testid={`dashboard-status-${status}`}
            className="border-b border-r border-ink p-4"
          >
            <p className="font-mono text-xs uppercase text-steel">
              {t(`applicationDashboard.status.${status}`)}
            </p>
            <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-ink">
              {counts[status]}
            </p>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
