'use client';

import React, { useEffect, useState } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dropdown } from '@/components/ui/dropdown';
import { Alert } from '@/components/ui/alert';
import { useTranslations } from '@/lib/i18n';
import { fetchResumeList, type ResumeListItem } from '@/lib/api/resume';
import { fetchJobPosting } from '@/lib/api/job-search';
import { createApplication, type ApplicationStatus } from '@/lib/api/tracker';

interface ManualAddApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ManualAddApplicationDialog({
  open,
  onOpenChange,
  onCreated,
}: ManualAddApplicationDialogProps) {
  const { t } = useTranslations();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [postingUrl, setPostingUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchedDetails, setFetchedDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Include the master resume — users may track an application against it.
    fetchResumeList(true)
      .then((items) => {
        setResumes(items);
        if (items.length > 0) setResumeId((prev) => prev || items[0].resume_id);
      })
      .catch(() => setResumes([]));
  }, [open]);

  const resumeLabel = (r: ResumeListItem): string =>
    r.title || r.filename || t('tracker.manualAdd.untitledResume');

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') e.stopPropagation();
  };

  const reset = () => {
    setPostingUrl('');
    setJobDescription('');
    setCompany('');
    setRole('');
    setStatus('applied');
    setFetchedDetails('');
    setError(null);
  };

  const handleFetch = async () => {
    const url = postingUrl.trim();
    if (!url || fetching) return;
    setFetching(true);
    setError(null);
    setFetchedDetails('');
    try {
      const posting = await fetchJobPosting(url);
      setJobDescription(posting.description);
      setCompany((current) => current.trim() || posting.company || '');
      setRole((current) => current.trim() || posting.title || '');
      const parts = [
        posting.title && `${t('tracker.manualAdd.role')}: ${posting.title}`,
        posting.location && `${t('tracker.manualAdd.location')}: ${posting.location}`,
        posting.skills.length > 0 &&
          `${t('tracker.manualAdd.skills')}: ${posting.skills.slice(0, 5).join(', ')}`,
      ].filter(Boolean);
      setFetchedDetails(parts.join(' · '));
    } catch {
      setError(t('tracker.manualAdd.fetchFailed'));
    } finally {
      setFetching(false);
    }
  };

  const handleFetchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleFetch();
    }
  };

  const handleSubmit = async () => {
    if (!resumeId || !jobDescription.trim()) {
      setError(t('tracker.manualAdd.validation'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createApplication({
        resume_id: resumeId,
        job_description: jobDescription.trim(),
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        job_url: postingUrl.trim() || undefined,
        status,
      });
      reset();
      onCreated();
      onOpenChange(false);
    } catch {
      setError(t('tracker.manualAdd.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Only the empty-description validation error belongs to the field.
  const descriptionMissing = error === t('tracker.manualAdd.validation') && !jobDescription.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('tracker.manualAdd.title')}</DialogTitle>
          <DialogDescription>{t('tracker.manualAdd.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Dropdown
            label={t('tracker.manualAdd.resume')}
            options={resumes.map((r) => ({ id: r.resume_id, label: resumeLabel(r) }))}
            value={resumeId}
            onChange={setResumeId}
          />

          <div className="space-y-1">
            <Label htmlFor="manual-job-url">{t('tracker.manualAdd.jobPostingUrl')}</Label>
            <div className="flex gap-2">
              <Input
                id="manual-job-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={postingUrl}
                onChange={(e) => setPostingUrl(e.target.value)}
                onKeyDown={handleFetchKeyDown}
                placeholder={t('tracker.manualAdd.jobPostingUrlPlaceholder')}
                disabled={fetching}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFetch}
                disabled={fetching || !postingUrl.trim()}
                className="shrink-0"
              >
                {fetching ? (
                  <>
                    <SpinnerGap aria-hidden="true" className="animate-spin" />
                    {t('tracker.manualAdd.fetching')}
                  </>
                ) : (
                  t('tracker.manualAdd.fetch')
                )}
              </Button>
            </div>
          </div>

          {fetchedDetails && (
            <Alert id="manual-fetch-status" tone="success">
              <p>{t('tracker.manualAdd.fetched')}</p>
              <p className="mt-1 font-mono text-xs uppercase text-steel">{fetchedDetails}</p>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="manual-jd">{t('tracker.manualAdd.jobDescription')}</Label>
            <Textarea
              id="manual-jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              onKeyDown={handleNotesKeyDown}
              placeholder={t('tracker.manualAdd.jobDescriptionPlaceholder')}
              rows={5}
              aria-invalid={descriptionMissing}
              aria-describedby={descriptionMissing ? 'manual-add-error' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="manual-company">{t('tracker.manualAdd.company')}</Label>
              <Input
                id="manual-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('tracker.manualAdd.optional')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-role">{t('tracker.manualAdd.role')}</Label>
              <Input
                id="manual-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t('tracker.manualAdd.optional')}
              />
            </div>
          </div>

          <Dropdown
            label={t('tracker.manualAdd.status')}
            options={[
              { id: 'applied', label: t('tracker.columns.applied') },
              { id: 'saved', label: t('tracker.columns.saved') },
            ]}
            value={status}
            onChange={(value) => setStatus(value as ApplicationStatus)}
          />

          {error && (
            <Alert id="manual-add-error" tone="error">
              {error}
            </Alert>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <SpinnerGap aria-hidden="true" className="animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('tracker.manualAdd.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
