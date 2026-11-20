/** Shared intake link used when a job posting is sent from Find Job to Tailor Resume. */

const TAILOR_INTAKE_STORAGE_KEY = 'rm.tailor-intake.v1';

export const TAILOR_JOB_URL_PARAM = 'jobUrl';

export interface TailorJobIntake {
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
}

export function tailorJobUrlHref(url: string): string {
  return `/tailor?${TAILOR_JOB_URL_PARAM}=${encodeURIComponent(url)}`;
}

export function readTailorJobUrl(search: string): string | null {
  const value = new URLSearchParams(search).get(TAILOR_JOB_URL_PARAM);
  return value?.trim() ? value.trim() : null;
}

/** Keep the full posting out of the URL while retaining it as a fetch fallback. */
export function stashTailorIntake(intake: TailorJobIntake): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TAILOR_INTAKE_STORAGE_KEY, JSON.stringify(intake));
  } catch {
    // Storage is optional; the URL fetch still works without the fallback.
  }
}

export function readTailorIntake(url: string): TailorJobIntake | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TAILOR_INTAKE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value.url !== url || typeof value.description !== 'string') return null;
    return {
      url,
      title: typeof value.title === 'string' ? value.title : '',
      company: typeof value.company === 'string' ? value.company : '',
      location: typeof value.location === 'string' ? value.location : null,
      description: value.description,
    };
  } catch {
    return null;
  }
}
