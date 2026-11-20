'use client';

import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslations } from '@/lib/i18n';

/** Placeholder route for upcoming agent workflows. */
export default function AgentPage() {
  const { t } = useTranslations();

  return (
    <PageFrame>
      <PageHeader>
        <PageHeader.Back href="/dashboard">{t('nav.backToDashboard')}</PageHeader.Back>
        <PageHeader.Title>{t('nav.agent')}</PageHeader.Title>
      </PageHeader>
      <div className="min-h-96" aria-hidden="true" />
    </PageFrame>
  );
}
