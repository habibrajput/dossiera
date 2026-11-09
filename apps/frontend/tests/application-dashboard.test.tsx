import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDashboard } from '@/components/dashboard/application-dashboard';
import { listApplications, type Application, type ApplicationColumns } from '@/lib/api/tracker';
import { fetchResume, fetchResumeList } from '@/lib/api/resume';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('@/lib/api/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tracker')>()),
  listApplications: vi.fn(),
}));

vi.mock('@/lib/api/resume', () => ({
  fetchResume: vi.fn(),
  fetchResumeList: vi.fn(),
}));

vi.mock('@/components/ui/page-frame', () => ({
  PageFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/tracker/manual-add-application-dialog', () => ({
  ManualAddApplicationDialog: ({ open, onCreated }: { open: boolean; onCreated: () => void }) =>
    open ? (
      <button type="button" onClick={onCreated}>
        create application
      </button>
    ) : (
      <div data-testid="manual-add-open">{String(open)}</div>
    ),
}));

vi.mock('@/components/tracker/card-detail-modal', () => ({
  CardDetailModal: ({
    applicationId,
    open,
    onOpenChange,
  }: {
    applicationId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onOpenChange(false)}>
        close {applicationId}
      </button>
    ) : (
      <output data-testid="card-detail-open">{String(open)}</output>
    ),
}));

function columns(cards: Application[]): ApplicationColumns {
  const result: ApplicationColumns = {
    saved: [],
    applied: [],
    no_response: [],
    response: [],
    interview: [],
    offer: [],
    accepted: [],
    rejected: [],
    declined: [],
  };
  for (const card of cards) result[card.status].push(card);
  return result;
}

function card(overrides: Partial<Application>): Application {
  return {
    application_id: 'app-1',
    job_id: 'job-1',
    resume_id: 'resume-1',
    master_resume_id: null,
    status: 'applied',
    company: 'Acme',
    role: 'Engineer',
    applied_at: '2026-11-03T10:30:00Z',
    notes: null,
    position: 0,
    created_at: '2026-11-02T10:30:00Z',
    updated_at: '2026-11-03T10:30:00Z',
    ...overrides,
  };
}

describe('ApplicationDashboard', () => {
  const NOW = new Date(2026, 10, 9, 8); // Monday morning, local time.

  const liveCards = () => [
    card({
      application_id: 'draft',
      status: 'saved',
      company: 'Acme',
      role: 'PHP Developer',
      applied_at: null,
      created_at: '2026-11-01T09:00:00Z',
      updated_at: '2026-11-01T09:00:00Z',
      deadline_at: '2026-11-02',
    }),
    card({
      application_id: 'quiet',
      status: 'no_response',
      company: 'InvoByte',
      role: 'Laravel Developer',
      created_at: '2026-11-01T09:00:00Z',
      updated_at: '2026-11-01T09:00:00Z',
      status_changed_at: '2026-11-01T09:00:00Z',
    }),
    card({
      application_id: 'screening',
      status: 'response',
      company: 'Beta',
      role: 'Full-stack Developer',
      applied_at: '2026-11-05T09:00:00Z',
      created_at: '2026-11-05T09:00:00Z',
      updated_at: '2026-11-07T09:00:00Z',
      heard_back_at: '2026-11-07T09:00:00Z',
      status_changed_at: '2026-11-07T09:00:00Z',
    }),
    card({
      application_id: 'offer',
      status: 'offer',
      company: 'Gamma',
      role: 'Product Engineer',
      applied_at: '2026-11-06T09:00:00Z',
      created_at: '2026-11-06T09:00:00Z',
      updated_at: '2026-11-08T09:00:00Z',
      heard_back_at: '2026-11-07T09:00:00Z',
      interview_at: '2026-11-07T09:00:00Z',
      offer_at: '2026-11-08T09:00:00Z',
      status_changed_at: '2026-11-08T09:00:00Z',
    }),
  ];

  function countFor(label: string): string {
    const cell = screen.getByTestId(`dashboard-status-${label}`);
    return within(cell).getByText(/^\d+$/).textContent ?? '';
  }

  async function renderDashboard(cards: Application[] = liveCards()) {
    vi.mocked(fetchResumeList).mockResolvedValue([
      {
        resume_id: 'master-1',
        title: 'Habib Rajput',
        filename: 'habib.pdf',
        is_master: true,
        is_default_master: true,
        parent_id: null,
        processing_status: 'ready',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    vi.mocked(fetchResume).mockResolvedValue({
      processed_resume: { personalInfo: { name: 'Habib Rajput' } },
    } as Awaited<ReturnType<typeof fetchResume>>);
    vi.mocked(listApplications).mockResolvedValue({ columns: columns(cards) });
    render(<ApplicationDashboard />);
    await act(async () => {});
  }

  describe('ApplicationDashboard tests', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      vi.clearAllMocks();
      localStorage.clear();
    });

    afterEach(() => {
      vi.useRealTimers();
      localStorage.clear();
    });

    it('renders a live greeting, dynamic summary, funnel and stage snapshot', async () => {
      await renderDashboard();

      expect(screen.getByText('applicationDashboard.goodMorning, Habib')).toBeInTheDocument();
      expect(screen.getByText('applicationDashboard.summary')).toBeInTheDocument();
      expect(countFor('saved')).toBe('1');
      expect(countFor('applied')).toBe('1');
      expect(countFor('response')).toBe('1');
      expect(countFor('offer')).toBe('1');
      expect(screen.getByText('Acme, PHP Developer')).toBeInTheDocument();
      expect(screen.getByText('InvoByte, Laravel Developer')).toBeInTheDocument();
    });

    it('updates the persisted follow-up threshold and the attention list immediately', async () => {
      await renderDashboard();

      const input = screen.getByLabelText('applicationDashboard.followUpLabel');
      fireEvent.change(input, { target: { value: '14' } });
      await act(async () => {});

      expect(screen.getByText('Acme, PHP Developer')).toBeInTheDocument();
      expect(screen.queryByText('InvoByte, Laravel Developer')).not.toBeInTheDocument();
      expect(localStorage.getItem('application_dashboard_follow_up_days')).toBe('14');
    });

    it('reloads real tracker data after creating an application', async () => {
      vi.mocked(fetchResumeList).mockResolvedValue([]);
      vi.mocked(listApplications)
        .mockResolvedValueOnce({ columns: columns([]) })
        .mockResolvedValueOnce({ columns: columns(liveCards()) });
      render(<ApplicationDashboard />);
      await act(async () => {});

      fireEvent.click(screen.getByRole('button', { name: 'applicationDashboard.newApplication' }));
      fireEvent.click(screen.getByRole('button', { name: 'create application' }));
      await act(async () => {});

      expect(countFor('saved')).toBe('1');
    });

    it('offers a retry after the initial application load fails', async () => {
      vi.mocked(fetchResumeList).mockResolvedValue([]);
      vi.mocked(listApplications)
        .mockRejectedValueOnce(new Error('offline'))
        .mockRejectedValueOnce(new Error('offline'));
      render(<ApplicationDashboard />);
      await act(async () => {});

      expect(screen.getByText('applicationDashboard.loadFailed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.retry' })).toBeEnabled();
    });
  });
});
