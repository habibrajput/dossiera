'use client';

import Link from 'next/link';
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  BookmarkSimple,
  PencilSimple,
  Trash,
  X,
} from '@phosphor-icons/react';
import { buttonClass, Button } from '@/components/ui/button';
import type { JobPosting } from '@/lib/api/job-search';
import { useTranslations } from '@/lib/i18n';
import { stashTailorIntake, tailorJobUrlHref } from '@/lib/utils/tailor-intake';

export type JobActionView = 'results' | 'saved' | 'dismissed';

interface JobActionsProps {
  job: JobPosting;
  view: JobActionView;
  isSaved: boolean;
  onSave: (job: JobPosting) => void;
  onDismiss: (job: JobPosting) => void;
  onRestore: (job: JobPosting) => void;
  onRemove: (job: JobPosting) => void;
}

/** Icon-only job actions shown once, in the details pane. */
export function JobActions({
  job,
  view,
  isSaved,
  onSave,
  onDismiss,
  onRestore,
  onRemove,
}: JobActionsProps) {
  const { t } = useTranslations();
  const size = 'icon-sm';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {job.url && (
        <Link
          href={tailorJobUrlHref(job.url)}
          className={buttonClass({ variant: 'secondary', size })}
          aria-label={`${t('nav.tailor')}: ${job.title}`}
          title={`${t('nav.tailor')}: ${job.title}`}
          onClick={() =>
            stashTailorIntake({
              url: job.url as string,
              title: job.title,
              company: job.company,
              location: job.location,
              description: job.description,
            })
          }
        >
          <PencilSimple aria-hidden="true" />
        </Link>
      )}
      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className={buttonClass({ variant: 'outline', size })}
          aria-label={`${t('findJobs.openPosting')}: ${job.title}`}
          title={`${t('findJobs.openPosting')}: ${job.title}`}
        >
          <ArrowSquareOut aria-hidden="true" />
        </a>
      )}
      {view === 'results' && (
        <>
          <Button
            type="button"
            size={size}
            variant={isSaved ? 'secondary' : 'outline'}
            aria-label={`${t(isSaved ? 'findJobs.saved' : 'findJobs.save')}: ${job.title}`}
            title={`${t(isSaved ? 'findJobs.saved' : 'findJobs.save')}: ${job.title}`}
            onClick={() => onSave(job)}
            disabled={isSaved}
          >
            <BookmarkSimple aria-hidden="true" weight={isSaved ? 'fill' : 'regular'} />
          </Button>
          <Button
            type="button"
            size={size}
            variant="outline-destructive"
            aria-label={`${t('findJobs.dismiss')}: ${job.title}`}
            title={`${t('findJobs.dismiss')}: ${job.title}`}
            onClick={() => onDismiss(job)}
          >
            <X aria-hidden="true" />
          </Button>
        </>
      )}
      {view === 'saved' && (
        <>
          <Button
            type="button"
            size={size}
            variant="outline-destructive"
            aria-label={`${t('findJobs.dismiss')}: ${job.title}`}
            title={`${t('findJobs.dismiss')}: ${job.title}`}
            onClick={() => onDismiss(job)}
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size={size}
            variant="ghost"
            aria-label={`${t('findJobs.remove')}: ${job.title}`}
            title={`${t('findJobs.remove')}: ${job.title}`}
            onClick={() => onRemove(job)}
          >
            <Trash aria-hidden="true" />
          </Button>
        </>
      )}
      {view === 'dismissed' && (
        <>
          <Button
            type="button"
            size={size}
            variant="outline"
            aria-label={`${t('findJobs.restore')}: ${job.title}`}
            title={`${t('findJobs.restore')}: ${job.title}`}
            onClick={() => onRestore(job)}
          >
            <ArrowCounterClockwise aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size={size}
            variant="ghost"
            aria-label={`${t('findJobs.remove')}: ${job.title}`}
            title={`${t('findJobs.remove')}: ${job.title}`}
            onClick={() => onRemove(job)}
          >
            <Trash aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  );
}
