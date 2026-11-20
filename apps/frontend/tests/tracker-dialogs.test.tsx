import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardDetailModal } from '@/components/tracker/card-detail-modal';
import { ManualAddApplicationDialog } from '@/components/tracker/manual-add-application-dialog';
import {
  createApplication,
  deleteApplication,
  getApplicationDetail,
  updateApplication,
  type ApplicationDetail,
} from '@/lib/api/tracker';
import type { ResumeListItem } from '@/lib/api/resume';
import { fetchJobPosting } from '@/lib/api/job-search';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: 'de' }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/api/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tracker')>()),
  getApplicationDetail: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
}));

const resume: ResumeListItem = {
  resume_id: 'r1',
  filename: 'cv.pdf',
  is_master: true,
  parent_id: null,
  processing_status: 'ready',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  title: 'Main CV',
};
vi.mock('@/lib/api/resume', () => ({ fetchResumeList: vi.fn(async () => [resume]) }));
vi.mock('@/lib/api/job-search', () => ({ fetchJobPosting: vi.fn() }));

const detail: ApplicationDetail = {
  application_id: 'a1',
  job_id: 'j1',
  resume_id: 'r2',
  master_resume_id: null,
  status: 'interview',
  company: 'ACME',
  role: 'Engineer',
  job_url: null,
  applied_at: '2026-03-15T00:00:00Z',
  notes: null,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  job_content: 'Build things.',
  resume: null,
};

describe('ManualAddApplicationDialog', () => {
  it('names each select by its own label plus the current value', async () => {
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' })
    ).toHaveAttribute('aria-haspopup', 'listbox');
    expect(
      screen.getByRole('button', { name: 'tracker.manualAdd.status tracker.columns.applied' })
    ).toHaveAttribute('aria-haspopup', 'listbox');
  });
});

describe('ManualAddApplicationDialog feedback', () => {
  it('fetches a posting link and prefills the description and metadata', async () => {
    vi.mocked(fetchJobPosting).mockResolvedValue({
      url: 'https://jobs.example/role',
      final_url: 'https://jobs.example/role',
      title: 'Senior Go Engineer',
      company: 'Acme',
      location: 'Berlin, DE',
      work_mode: 'remote',
      skills: ['Go', 'PostgreSQL'],
      job_req_id: 'REQ-42',
      description: 'Build the payments API in Go.',
      source: 'json-ld',
    });
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });

    fireEvent.change(screen.getByRole('textbox', { name: 'tracker.manualAdd.jobPostingUrl' }), {
      target: { value: 'https://jobs.example/role' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.fetch' }));

    expect(await screen.findByRole('status')).toHaveTextContent('tracker.manualAdd.fetched');
    expect(fetchJobPosting).toHaveBeenCalledWith('https://jobs.example/role');
    expect(screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' })).toHaveValue(
      'Build the payments API in Go.'
    );
    expect(screen.getByRole('textbox', { name: 'tracker.manualAdd.company' })).toHaveValue('Acme');
    expect(screen.getByRole('textbox', { name: 'tracker.manualAdd.role' })).toHaveValue(
      'Senior Go Engineer'
    );
  });

  it('keeps fetch failures out of the description field', async () => {
    vi.mocked(fetchJobPosting).mockRejectedValue(new Error('offline'));
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });

    fireEvent.change(screen.getByRole('textbox', { name: 'tracker.manualAdd.jobPostingUrl' }), {
      target: { value: 'https://jobs.example/role' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.fetch' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tracker.manualAdd.fetchFailed');
    expect(
      screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' })
    ).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('ties the validation error to the job description field', async () => {
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    const field = screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' });
    expect(field).not.toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(screen.getByRole('alert')).toHaveTextContent('tracker.manualAdd.validation');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('tracker.manualAdd.validation');
  });

  it('does not tie an unrelated failure to the job description field', async () => {
    vi.mocked(createApplication).mockRejectedValue(new Error('offline'));
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    const field = screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' });
    fireEvent.change(field, { target: { value: 'Build things.' } });

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tracker.manualAdd.failed');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the submit button named while it is saving', async () => {
    vi.mocked(createApplication).mockReturnValue(new Promise(() => {}));
    render(<ManualAddApplicationDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('button', { name: 'tracker.manualAdd.resume Main CV' });
    fireEvent.change(screen.getByRole('textbox', { name: 'tracker.manualAdd.jobDescription' }), {
      target: { value: 'Build things.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'tracker.manualAdd.submit' }));

    expect(await screen.findByRole('button', { name: 'common.saving' })).toBeDisabled();
  });
});

describe('CardDetailModal', () => {
  it('announces loading instead of showing a silent spinner', () => {
    vi.mocked(getApplicationDetail).mockReturnValue(new Promise(() => {}));
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
  });

  it('keeps the save-notes button named while it is saving', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    vi.mocked(updateApplication).mockReturnValue(new Promise(() => {}));
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'tracker.modal.saveNotes' }));

    expect(await screen.findByRole('button', { name: 'common.saving' })).toBeDisabled();
  });

  it('shows the stage, a UI-locale date and a missing-resume warning', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    expect(await screen.findByText('tracker.columns.interview')).toBeInTheDocument();
    const expected = new Intl.DateTimeFormat('de', { month: 'short', year: 'numeric' }).format(
      new Date(detail.applied_at as string)
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('tracker.modal.resumeUnavailable');
  });

  it('links to the posting and the tailored resume from the detail body', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue({
      ...detail,
      job_url: 'https://jobs.example/role',
      resume: { resume_id: 'r2' },
    });
    render(<CardDetailModal applicationId="a1" open onOpenChange={vi.fn()} onUpdated={vi.fn()} />);

    expect(await screen.findByRole('link', { name: 'findJobs.openPosting' })).toHaveAttribute(
      'href',
      'https://jobs.example/role'
    );
    expect(screen.getByRole('link', { name: 'dashboard.tailoredResume' })).toHaveAttribute(
      'href',
      '/resumes/r2'
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('deletes the card after confirmation and closes the detail', async () => {
    vi.mocked(getApplicationDetail).mockResolvedValue(detail);
    vi.mocked(deleteApplication).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CardDetailModal applicationId="a1" open onOpenChange={onOpenChange} onUpdated={onUpdated} />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));
    const confirmation = screen.getAllByRole('dialog').at(-1) as HTMLElement;
    fireEvent.click(within(confirmation).getByRole('button', { name: 'common.delete' }));

    await vi.waitFor(() => expect(deleteApplication).toHaveBeenCalledWith('a1'));
    expect(onUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
