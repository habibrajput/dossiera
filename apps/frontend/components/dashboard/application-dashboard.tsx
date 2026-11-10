'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, SpinnerGap } from '@phosphor-icons/react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ManualAddApplicationDialog } from '@/components/tracker/manual-add-application-dialog';
import { CardDetailModal } from '@/components/tracker/card-detail-modal';
import { useTranslations } from '@/lib/i18n';
import { listApplications, type ApplicationColumns } from '@/lib/api/tracker';
import { fetchResume, fetchResumeList } from '@/lib/api/resume';
import {
  DEFAULT_FOLLOW_UP_DAYS,
  flattenApplications,
  getAttentionItems,
  getCalendarEvents,
  getDashboardAnalytics,
  readFollowUpDays,
  writeFollowUpDays,
  type DashboardPeriod,
} from '@/lib/utils/application-analytics';
import { ApplicationFunnel } from './application-funnel';
import { WeeklyActivity } from './weekly-activity';
import { StatusOverview } from './status-overview';
import { AttentionList } from './attention-list';
import { ApplicationCalendar } from './application-calendar';

export function ApplicationDashboard() {
  const { t } = useTranslations();
  const [columns, setColumns] = useState<ApplicationColumns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('30');
  const [followUpDays, setFollowUpDays] = useState(DEFAULT_FOLLOW_UP_DAYS);
  const [firstName, setFirstName] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const data = await listApplications();
      if (id !== requestId.current) return;
      setColumns(data.columns);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    setFollowUpDays(readFollowUpDays());
  }, [load]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resumes = await fetchResumeList(true);
        const master =
          resumes.find((resume) => resume.is_master && resume.is_default_master) ??
          resumes.find((resume) => resume.is_master);
        if (!master) return;
        const detail = await fetchResume(master.resume_id);
        const fullName = detail.processed_resume?.personalInfo?.name?.trim();
        if (!cancelled && fullName) setFirstName(fullName.split(/\s+/)[0]);
      } catch {
        // The greeting remains useful without a parsed resume or profile name.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applications = useMemo(() => (columns ? flattenApplications(columns) : []), [columns]);
  const analytics = useMemo(
    () => (now ? getDashboardAnalytics(applications, period, now) : null),
    [applications, period, now]
  );
  const attention = useMemo(
    () => (now ? getAttentionItems(applications, now, followUpDays) : []),
    [applications, now, followUpDays]
  );
  const calendarEvents = useMemo(() => getCalendarEvents(applications), [applications]);

  const changeFollowUpDays = (days: number) => {
    setFollowUpDays(days);
    writeFollowUpDays(days);
  };

  if (!now || (loading && !columns)) {
    return (
      <PageFrame width="wide">
        <div role="status" className="flex min-h-72 items-center justify-center gap-3 p-12">
          <SpinnerGap aria-hidden="true" className="size-6 animate-spin text-steel" />
          <span>{t('common.loading')}</span>
        </div>
      </PageFrame>
    );
  }

  if (error && !columns) {
    return (
      <PageFrame width="wide">
        <PageHeader>
          <PageHeader.Title>{t('nav.dashboard')}</PageHeader.Title>
        </PageHeader>
        <div className="space-y-4 p-6 md:p-8">
          <Alert tone="error">{t('applicationDashboard.loadFailed')}</Alert>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </PageFrame>
    );
  }

  if (!analytics) return null;
  const hour = now.getHours();
  const greetingKey =
    hour >= 5 && hour < 12
      ? 'applicationDashboard.goodMorning'
      : hour >= 12 && hour < 17
        ? 'applicationDashboard.goodAfternoon'
        : 'applicationDashboard.goodEvening';
  const greeting = `${t(greetingKey)}${firstName ? `, ${firstName}` : ''}`;
  const summary = t(
    analytics.sent.length === 1
      ? 'applicationDashboard.summaryOne'
      : 'applicationDashboard.summary',
    { sent: analytics.sent.length, heardBack: analytics.heardBack }
  );

  return (
    <PageFrame width="wide">
      <PageHeader>
        <PageHeader.Title>{greeting}</PageHeader.Title>
        <PageHeader.Subtitle>{t('applicationDashboard.subtitle')}</PageHeader.Subtitle>
        <PageHeader.Actions>
          <Button type="button" onClick={() => setManualAddOpen(true)}>
            <Plus aria-hidden="true" />
            {t('applicationDashboard.newApplication')}
          </Button>
          {loading && columns && (
            <span role="status" className="flex items-center gap-2 font-mono text-xs text-steel">
              <SpinnerGap aria-hidden="true" className="size-4 animate-spin" />
              {t('common.loading')}
            </span>
          )}
        </PageHeader.Actions>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <section aria-label={t('applicationDashboard.overview')}>
          <p className="max-w-[76ch] text-lg leading-relaxed text-ink-soft">{summary}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {analytics.sent.length
              ? t('applicationDashboard.encouragement')
              : t('applicationDashboard.startEncouragement')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs font-bold uppercase text-ink">
              {t('applicationDashboard.showing')}
            </span>
            <SegmentedControl
              aria-label={t('applicationDashboard.period')}
              value={period}
              onChange={setPeriod}
              size="sm"
              items={[
                { value: '30', label: t('applicationDashboard.last30') },
                { value: '90', label: t('applicationDashboard.last90') },
                { value: 'all', label: t('applicationDashboard.allTime') },
              ]}
            />
          </div>
        </section>

        {error && <Alert tone="error">{t('applicationDashboard.refreshFailed')}</Alert>}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ApplicationFunnel analytics={analytics} />
          <WeeklyActivity
            weekly={analytics.weekly}
            started={analytics.started.length}
            sent={analytics.sent.length}
          />
        </div>

        <StatusOverview counts={analytics.statusCounts} />

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <AttentionList
            items={attention}
            followUpDays={followUpDays}
            onFollowUpDaysChange={changeFollowUpDays}
            onOpen={setOpenCardId}
          />
          <ApplicationCalendar events={calendarEvents} now={now} onOpen={setOpenCardId} />
        </div>
      </div>

      <ManualAddApplicationDialog
        open={manualAddOpen}
        onOpenChange={setManualAddOpen}
        onCreated={() => void load()}
      />
      <CardDetailModal
        applicationId={openCardId}
        open={Boolean(openCardId)}
        onOpenChange={(open) => {
          if (!open) setOpenCardId(null);
        }}
        onUpdated={() => void load()}
      />
    </PageFrame>
  );
}
