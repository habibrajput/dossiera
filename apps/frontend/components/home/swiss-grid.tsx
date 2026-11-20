'use client';

import React from 'react';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslations } from '@/lib/i18n';

export const SwissGrid = ({
  banner,
  children,
}: {
  /** Page-level alerts, shown inside the frame above the tiles. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const { t } = useTranslations();

  return (
    <PageFrame height="screen" className="h-full">
      <PageHeader>
        <PageHeader.Title>{t('nav.resumeBoard')}</PageHeader.Title>
        <PageHeader.Subtitle>{t('dashboard.selectModule')}</PageHeader.Subtitle>
      </PageHeader>

      {/* Content Grid - Scrollable area with NO padding.
          @container makes the card grid respond to the container's actual
          width, not the viewport. The Swiss frame is max-w-86rem so on
          ultra-wide screens the cards no longer over-stretch. */}
      <div className="@container flex-1 overflow-y-auto overflow-x-hidden relative z-10">
        <h2 className="sr-only">{t('dashboard.modulesHeading')}</h2>
        {banner && <div className="space-y-4 p-6">{banner}</div>}
        <div className="p-[1.5px]">
          <div className="grid grid-cols-1 @2xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5 bg-ink gap-[1px] border-b border-ink">
            {children}
          </div>
        </div>
      </div>
    </PageFrame>
  );
};
