'use client';

import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslations } from '@/lib/i18n';

export function WorkspacePage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslations();

  return (
    <PageFrame width="narrow">
      <PageHeader>
        <PageHeader.Title>{t(titleKey)}</PageHeader.Title>
        <PageHeader.Subtitle>{t('nav.workspaceDescription')}</PageHeader.Subtitle>
      </PageHeader>
      <div className="p-8 md:p-12">
        <EmptyState
          title={t('nav.comingSoon')}
          action={
            <Link href="/dashboard" className={buttonClass({ variant: 'outline' })}>
              <ArrowLeft aria-hidden="true" />
              {t('nav.backToDashboard')}
            </Link>
          }
        />
      </div>
    </PageFrame>
  );
}
