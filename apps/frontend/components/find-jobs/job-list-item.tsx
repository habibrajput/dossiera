'use client';

import type { JobPosting } from '@/lib/api/job-search';
import { formatDate } from '@/lib/find-jobs-view';
import { useTranslations } from '@/lib/i18n';

interface JobListItemProps {
  job: JobPosting;
  isSelected: boolean;
  stampLabel?: string;
  onSelect: (job: JobPosting) => void;
}

/** Compact selectable row for the left-hand job list. Actions live in the details pane. */
export function JobListItem({ job, isSelected, stampLabel, onSelect }: JobListItemProps) {
  const { t, locale } = useTranslations();
  const posted = formatDate(job.posted_at, locale);
  const meta = [job.location, posted && t('findJobs.postedOn', { date: posted }), stampLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      className={`border bg-white p-2 shadow-sw-nested ${
        isSelected ? 'border-primary bg-info-tint' : 'border-ink hover:bg-panel'
      }`}
    >
      <button
        type="button"
        aria-label={job.title}
        aria-pressed={isSelected}
        onClick={() => onSelect(job)}
        className="block w-full rounded-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="block break-words font-serif text-base font-bold leading-snug text-ink">
          {job.title}
        </span>
        <span className="mt-1 block truncate font-mono text-xs uppercase text-ink-soft">
          {job.company}
        </span>
        {meta && (
          <span className="mt-1 block truncate font-mono text-xs uppercase text-steel">{meta}</span>
        )}
      </button>
    </li>
  );
}
