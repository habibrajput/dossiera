'use client';

import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { Button, buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import type { AttentionItem } from '@/lib/utils/application-analytics';
import { DashboardSection } from './dashboard-section';

interface AttentionListProps {
  items: AttentionItem[];
  followUpDays: number;
  onFollowUpDaysChange: (days: number) => void;
  onOpen: (applicationId: string) => void;
}

export function AttentionList({
  items,
  followUpDays,
  onFollowUpDaysChange,
  onOpen,
}: AttentionListProps) {
  const { t, locale } = useTranslations();

  return (
    <DashboardSection
      title={t('applicationDashboard.attentionTitle')}
      description={t('applicationDashboard.attentionCount', { count: items.length })}
    >
      {items.length === 0 ? (
        <p className="py-6 text-sm text-ink-soft">{t('applicationDashboard.attentionEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => {
            const { application } = item;
            return (
              <li key={`${item.kind}-${application.application_id}`} className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink">
                      {application.company || t('applicationDashboard.unknownCompany')}
                      {application.role ? `, ${application.role}` : ''}
                    </h3>
                    <p className="mt-2 text-sm text-ink-soft">
                      {item.kind === 'deadline'
                        ? t(
                            item.days > 0
                              ? 'applicationDashboard.deadlineOverdue'
                              : 'applicationDashboard.deadlineUpcoming',
                            { date: formatDate(item.date, locale) }
                          )
                        : t('applicationDashboard.noNews', { days: item.days })}
                    </p>
                  </div>
                  {item.kind === 'deadline' ? (
                    <Link
                      href={`/builder?id=${application.resume_id}`}
                      className={buttonClass({ variant: 'outline', size: 'sm' })}
                    >
                      {t('applicationDashboard.finish')}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpen(application.application_id)}
                    >
                      {t('applicationDashboard.open')}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 border-t border-panel pt-6">
        <Label htmlFor="follow-up-days">{t('applicationDashboard.followUpLabel')}</Label>
        <div className="mt-2 flex items-center gap-3">
          <Input
            id="follow-up-days"
            type="number"
            min={1}
            max={90}
            value={followUpDays}
            onChange={(event) => {
              if (Number.isInteger(event.target.valueAsNumber)) {
                onFollowUpDaysChange(Math.min(90, Math.max(1, event.target.valueAsNumber)));
              }
            }}
            className="w-24"
          />
          <span className="text-sm text-ink-soft">{t('applicationDashboard.withoutNews')}</span>
        </div>
      </div>
    </DashboardSection>
  );
}
