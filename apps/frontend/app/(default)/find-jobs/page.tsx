'use client';

import { FindJobsWorkspace } from '@/components/find-jobs/find-jobs-workspace';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslations } from '@/lib/i18n';

/** Find Job workspace. */
export default function FindJobsPage() {
  const { t } = useTranslations();

  return (
    <PageFrame width="wide">
      <PageHeader>
        <PageHeader.Back href="/dashboard">{t('nav.backToDashboard')}</PageHeader.Back>
        <PageHeader.Title>{t('nav.findJobs')}</PageHeader.Title>
        <PageHeader.Subtitle>{t('findJobs.subtitle')}</PageHeader.Subtitle>
      </PageHeader>
      <div className="p-6 md:p-12">
        <FindJobsWorkspace />
      </div>
    </PageFrame>
  );
}
