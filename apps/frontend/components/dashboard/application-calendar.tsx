'use client';

import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, ArrowSquareOut } from '@phosphor-icons/react';
import { Button, buttonClass } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  buildCalendarDays,
  dateKey,
  getGoogleCalendarUrl,
  type ApplicationCalendarEvent,
} from '@/lib/utils/application-analytics';
import { DashboardSection } from './dashboard-section';

interface ApplicationCalendarProps {
  events: ApplicationCalendarEvent[];
  now: Date;
  onOpen: (applicationId: string) => void;
}

export function ApplicationCalendar({ events, now, onOpen }: ApplicationCalendarProps) {
  const { t, locale } = useTranslations();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(dateKey(now));
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) counts.set(event.key, (counts.get(event.key) ?? 0) + 1);
    return counts;
  }, [events]);
  const selectedEvents = events
    .filter((event) => event.key === selectedKey)
    .sort((a, b) => a.kind.localeCompare(b.kind));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    month
  );
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, index + 1))
  );

  const moveMonth = (amount: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelectedKey(dateKey(next));
  };
  const showToday = () => {
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(dateKey(now));
  };

  return (
    <DashboardSection
      title={t('applicationDashboard.calendarTitle')}
      action={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={showToday}>
            {t('applicationDashboard.today')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('applicationDashboard.previousMonth')}
            onClick={() => moveMonth(-1)}
          >
            <CaretLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('applicationDashboard.nextMonth')}
            onClick={() => moveMonth(1)}
          >
            <CaretRight aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <h3 className="mb-4 text-center font-mono text-sm font-bold uppercase text-ink">
        {monthLabel}
      </h3>
      <div className="grid grid-cols-7 border-l border-t border-border text-center">
        {weekdays.map((weekday, index) => (
          <div
            key={index}
            className="border-b border-r border-border bg-panel p-2 font-mono text-xs"
          >
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const count = eventCounts.get(day.key) ?? 0;
          const selected = day.key === selectedKey;
          const today = day.key === dateKey(now);
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={selected}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day.date)}
              onClick={() => setSelectedKey(day.key)}
              className={cn(
                'relative min-h-11 border-b border-r border-border p-2 font-mono text-sm focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                day.inMonth ? 'text-ink' : 'text-steel',
                today && 'font-bold underline',
                selected ? 'bg-ink text-white' : 'hover:bg-panel'
              )}
            >
              {day.day}
              {count > 0 && (
                <span
                  className={cn(
                    'absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2',
                    selected ? 'bg-white' : 'bg-primary'
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <h4 className="font-mono text-xs font-bold uppercase text-ink">
          {selectedKey
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(
                new Date(`${selectedKey}T12:00:00`)
              )
            : t('applicationDashboard.noDateSelected')}
        </h4>
        {selectedEvents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t('applicationDashboard.noEvents')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-panel border-y border-panel">
            {selectedEvents.map((event) => {
              const title = `${event.application.company || t('applicationDashboard.unknownCompany')}${
                event.application.role ? ` — ${event.application.role}` : ''
              }`;
              return (
                <li key={event.id} className="py-3 text-sm">
                  <p className="font-mono text-xs uppercase text-steel">
                    {t(`applicationDashboard.event.${event.kind}`)}
                  </p>
                  <p className="mt-1 font-semibold text-ink">{title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpen(event.application.application_id)}
                    >
                      {t('applicationDashboard.open')}
                    </Button>
                    {event.kind === 'deadline' && (
                      <a
                        href={getGoogleCalendarUrl(
                          event,
                          t('applicationDashboard.googleEventTitle', { title })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass({ variant: 'ghost', size: 'sm' })}
                      >
                        {t('applicationDashboard.addToGoogle')}
                        <ArrowSquareOut aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-6 font-mono text-xs text-steel">
        {t('applicationDashboard.timeZone', { timeZone })}
      </p>
    </DashboardSection>
  );
}
