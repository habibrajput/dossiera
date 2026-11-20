'use client';

import type { JobPosting } from '@/lib/api/job-search';
import { inferLevel } from '@/lib/find-jobs';
import { formatDate } from '@/lib/find-jobs-view';
import { useTranslations } from '@/lib/i18n';
import { JobActions, type JobActionView } from './job-actions';

interface JobDetailPanelProps {
  job: JobPosting;
  view: JobActionView;
  isSaved: boolean;
  stampLabel?: string;
  onSave: (job: JobPosting) => void;
  onDismiss: (job: JobPosting) => void;
  onRestore: (job: JobPosting) => void;
  onRemove: (job: JobPosting) => void;
}

/** Full posting for the job selected in the compact list. */
export function JobDetailPanel({
  job,
  view,
  isSaved,
  stampLabel,
  onSave,
  onDismiss,
  onRestore,
  onRemove,
}: JobDetailPanelProps) {
  const { t, locale } = useTranslations();
  const level = inferLevel(job);
  const posted = formatDate(job.posted_at, locale);
  const knownWorkModes = ['remote', 'hybrid', 'onsite'];
  const workModeLabel = job.work_mode
    ? knownWorkModes.includes(job.work_mode)
      ? t(`findJobs.workModes.${job.work_mode}`)
      : job.work_mode
    : null;

  return (
    <section
      aria-labelledby="find-jobs-details-title"
      className="flex flex-col border border-ink bg-white shadow-sw-nested lg:sticky lg:top-16"
    >
      <div className="flex items-start justify-between gap-3 border-b border-ink p-4">
        <div className="min-w-0">
          <h3 id="find-jobs-details-title" className="font-serif text-2xl font-bold text-ink">
            {job.title}
          </h3>
          <p className="mt-1 font-mono text-sm font-bold uppercase text-ink-soft">{job.company}</p>
          <p className="mt-1 font-mono text-xs uppercase text-steel">
            {[job.location, posted && t('findJobs.postedOn', { date: posted }), stampLabel]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <JobActions
          job={job}
          view={view}
          isSaved={isSaved}
          onSave={onSave}
          onDismiss={onDismiss}
          onRestore={onRestore}
          onRemove={onRemove}
        />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {workModeLabel && (
            <span className="border border-ink bg-info-tint px-2 py-1 font-mono text-xs uppercase text-ink">
              {workModeLabel}
            </span>
          )}
          {level && (
            <span className="border border-ink bg-paper px-2 py-1 font-mono text-xs uppercase text-ink">
              {t('findJobs.levelDetected', { level: t(`findJobs.levelOptions.${level}`) })}
            </span>
          )}
          {job.source && (
            <span className="border border-ink bg-paper px-2 py-1 font-mono text-xs uppercase text-steel">
              {job.source}
            </span>
          )}
        </div>

        {job.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <span
                key={skill}
                className="border border-panel-hover bg-canvas px-2 py-1 font-mono text-xs text-ink-soft"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
          {job.description}
        </p>
      </div>
    </section>
  );
}
