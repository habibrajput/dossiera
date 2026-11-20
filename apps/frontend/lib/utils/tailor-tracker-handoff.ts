/** Background handoff from Find Job's Tailor action into the tracker board. */

import { fetchResumeList } from '@/lib/api/resume';
import { createApplication } from '@/lib/api/tracker';
import type { TailorJobIntake } from './tailor-intake';

const MASTER_RESUME_KEY = 'master_resume_id';
const ENQUEUED_KEY = 'rm.tailored-queue.v1';

export const TAILOR_QUEUE_EVENT = 'rm:tailored-queue-updated';

function readEnqueued(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ENQUEUED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function markEnqueued(url: string, queued: boolean): void {
  if (typeof window === 'undefined') return;
  const next = new Set(readEnqueued());
  if (queued) next.add(url);
  else next.delete(url);
  try {
    window.localStorage.setItem(ENQUEUED_KEY, JSON.stringify([...next]));
  } catch {
    // Storage is optional; dedupe is best-effort.
  }
}

function buildDescription(intake: TailorJobIntake): string {
  const details = [intake.title, intake.company, intake.location]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' · ');
  const body = intake.description.trim() || details || 'Job posting';
  return `${body}\n\nSource: ${intake.url}`;
}

async function resolveMasterResumeId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(MASTER_RESUME_KEY)?.trim();
  if (stored) return stored;
  try {
    const rows = await fetchResumeList(true);
    const ready = rows.filter((row) => row.processing_status === 'ready');
    const initial =
      ready.find((row) => row.is_default_master) ?? ready.find((row) => row.is_master) ?? ready[0];
    if (!initial) return null;
    window.localStorage.setItem(MASTER_RESUME_KEY, initial.resume_id);
    return initial.resume_id;
  } catch {
    return null;
  }
}

/**
 * Add the posting to the Tailored Queue column without delaying the navigation
 * to /tailor. Returns true only when a new card was actually created.
 */
export async function enqueueTailoredApplication(intake: TailorJobIntake): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (readEnqueued().includes(intake.url)) return false;

  const resumeId = await resolveMasterResumeId();
  if (!resumeId) return false;

  // Claim the URL before the request so a double click can't create two cards.
  markEnqueued(intake.url, true);
  try {
    await createApplication({
      resume_id: resumeId,
      job_description: buildDescription(intake),
      company: intake.company.trim() || undefined,
      role: intake.title.trim() || undefined,
      job_url: intake.url,
      status: 'tailored_queue',
    });
    window.dispatchEvent(new Event(TAILOR_QUEUE_EVENT));
    return true;
  } catch {
    markEnqueued(intake.url, false);
    return false;
  }
}
