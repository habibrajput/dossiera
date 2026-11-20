import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchResumeList } from '@/lib/api/resume';
import { createApplication } from '@/lib/api/tracker';
import type { TailorJobIntake } from '@/lib/utils/tailor-intake';
import { enqueueTailoredApplication, TAILOR_QUEUE_EVENT } from '@/lib/utils/tailor-tracker-handoff';

vi.mock('@/lib/api/tracker', () => ({ createApplication: vi.fn() }));
vi.mock('@/lib/api/resume', () => ({ fetchResumeList: vi.fn() }));

const intake: TailorJobIntake = {
  url: 'https://jobs.example/senior-laravel',
  title: 'Senior Laravel Engineer',
  company: 'Acme',
  location: 'Paris',
  description: 'Build and maintain Laravel APIs.',
};

describe('Tailor Resume → Tailored Queue handoff', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(createApplication).mockResolvedValue({} as never);
    vi.mocked(fetchResumeList).mockResolvedValue([]);
  });

  it('creates a tailored_queue card with the stored master and posting metadata', async () => {
    localStorage.setItem('master_resume_id', 'master-1');
    const onUpdate = vi.fn();
    window.addEventListener(TAILOR_QUEUE_EVENT, onUpdate);

    await expect(enqueueTailoredApplication(intake)).resolves.toBe(true);

    expect(createApplication).toHaveBeenCalledWith({
      resume_id: 'master-1',
      job_description:
        'Build and maintain Laravel APIs.\n\nSource: https://jobs.example/senior-laravel',
      company: 'Acme',
      role: 'Senior Laravel Engineer',
      job_url: 'https://jobs.example/senior-laravel',
      status: 'tailored_queue',
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    window.removeEventListener(TAILOR_QUEUE_EVENT, onUpdate);
  });

  it('does not create a second card for the same posting', async () => {
    localStorage.setItem('master_resume_id', 'master-1');

    await expect(enqueueTailoredApplication(intake)).resolves.toBe(true);
    await expect(enqueueTailoredApplication(intake)).resolves.toBe(false);

    expect(createApplication).toHaveBeenCalledTimes(1);
  });

  it('resolves the default master when none is stored yet', async () => {
    vi.mocked(fetchResumeList).mockResolvedValue([
      {
        resume_id: 'other',
        processing_status: 'ready',
        is_master: true,
        is_default_master: false,
      },
      {
        resume_id: 'default',
        processing_status: 'ready',
        is_master: true,
        is_default_master: true,
      },
    ] as never);

    await expect(enqueueTailoredApplication(intake)).resolves.toBe(true);

    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ resume_id: 'default' })
    );
    expect(localStorage.getItem('master_resume_id')).toBe('default');
  });

  it('allows a retry after a failed background request', async () => {
    localStorage.setItem('master_resume_id', 'master-1');
    vi.mocked(createApplication)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({} as never);

    await expect(enqueueTailoredApplication(intake)).resolves.toBe(false);
    await expect(enqueueTailoredApplication(intake)).resolves.toBe(true);

    expect(createApplication).toHaveBeenCalledTimes(2);
  });
});
