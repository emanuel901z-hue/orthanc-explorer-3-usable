import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CopyJobsPage from './CopyJobsPage';
import type { OrthancJob } from '@/api/jobs';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import i18n from '@/i18n';

const { mockJobs } = vi.hoisted(() => ({ mockJobs: vi.fn() }));

vi.mock('@/features/activity/hooks/useOrthancJobs', () => ({
  useOrthancJobs: () => mockJobs(),
}));

function job(overrides: Partial<OrthancJob> = {}): OrthancJob {
  return {
    ID: 'job-1',
    Type: 'DicomMoveScu',
    State: 'Success',
    Progress: 100,
    CreationTime: '20261106T114657.025637',
    EffectiveRuntime: 1.5,
    ErrorDescription: 'Success',
    Content: {
      RemoteAet: 'ARCHIVE',
      TargetAet: 'hst_burn2CD',
      Query: [{ '0020,000d': '1.2.3', '0010,0020': 'P-100' }],
      Details: [{ DimseErrorStatus: 0 }],
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CopyJobsPage />
    </MemoryRouter>,
  );
}

describe('CopyJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // der Statusfilter wird persistiert — sonst trägt ihn der nächste Test weiter
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
    window.localStorage.clear();
  });

  it('zeigt nur C-MOVE-Jobs mit Ziel, Studie und Status', () => {
    mockJobs.mockReturnValue({
      data: [
        job(),
        job({ ID: 'job-store', Type: 'DicomStore', Content: {} }),
      ],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/copy jobs|kopieraufträge/i);
    expect(screen.getByText('hst_burn2CD')).toBeInTheDocument();
    expect(screen.getByText('P-100')).toBeInTheDocument();
    expect(screen.getByText('0x0000')).toBeInTheDocument();
    // der DicomStore-Job gehört nicht in diese Liste
    expect(screen.getAllByRole('row')).toHaveLength(2); // Kopfzeile + eine Zeile
  });

  it('filtert nach Fehlschlägen', () => {
    mockJobs.mockReturnValue({
      data: [
        job(),
        job({
          ID: 'job-2',
          State: 'Failure',
          ErrorDescription: 'Error in the network protocol',
          Content: { TargetAet: 'JungPacs', Details: [{ DimseErrorStatus: 0xa801 }] },
        }),
      ],
      isLoading: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText('JungPacs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /failed|fehlgeschlagen/i }));

    expect(screen.queryByText('hst_burn2CD')).not.toBeInTheDocument();
    expect(screen.getByText('JungPacs')).toBeInTheDocument();
    expect(screen.getByText('0xA801')).toBeInTheDocument();
  });

  it('zeigt einen laufenden Auftrag mit Fortschritt', () => {
    mockJobs.mockReturnValue({
      data: [job({ State: 'Running', Progress: 40, CompletionTime: undefined })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/40\s*%/)).toBeInTheDocument();
  });

  it('erklärt die leere Liste', () => {
    mockJobs.mockReturnValue({ data: [], isLoading: false, isError: false });

    renderPage();

    expect(screen.getByText(/no copy orders yet|noch keine kopieraufträge/i)).toBeInTheDocument();
  });

  it('meldet einen Ladefehler', () => {
    mockJobs.mockReturnValue({ data: [], isLoading: false, isError: true });

    renderPage();

    expect(screen.getByText(/could not be loaded|konnten nicht geladen werden/i)).toBeInTheDocument();
  });

  it('zeigt Zeit und Dauer lesbar statt im Orthanc-Format', async () => {
    await i18n.changeLanguage('de');
    mockJobs.mockReturnValue({
      data: [job({ CreationTime: '20261106T114657.029587', EffectiveRuntime: 90 })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    // deutsch: dd.mm.yyyy, 24-Stunden-Zeit — nicht "20261106T114657"
    expect(screen.getByText('06.11.2026, 11:46')).toBeInTheDocument();
    expect(screen.getByText('1 min 30 s')).toBeInTheDocument();
  });

  it('zeigt die Zeit in der englischen Schreibweise, wenn die Oberfläche englisch ist', async () => {
    await i18n.changeLanguage('en');
    mockJobs.mockReturnValue({
      data: [job({ CreationTime: '20261106T114657.029587' })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/11\/06\/2026/)).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });

  it('filtert laufende Aufträge', () => {
    mockJobs.mockReturnValue({
      data: [
        job(),
        job({ ID: 'job-2', State: 'Running', Progress: 20, Content: { TargetAet: 'JungPacs' } }),
      ],
      isLoading: false,
      isError: false,
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /running|läuft/i }));

    expect(screen.getByText('JungPacs')).toBeInTheDocument();
    expect(screen.queryByText('hst_burn2CD')).not.toBeInTheDocument();
  });

  it('zählt die Aufträge je Filter', () => {
    mockJobs.mockReturnValue({
      data: [job(), job({ ID: 'job-2', State: 'Failure', Content: { TargetAet: 'X' } })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByRole('button', { name: /all|alle/i })).toHaveTextContent('(2)');
    expect(screen.getByRole('button', { name: /failed|fehlgeschlagen/i })).toHaveTextContent('(1)');
    expect(screen.getByRole('button', { name: /running|läuft/i })).toHaveTextContent('(0)');
  });

  it('erklärt einen Filter ohne Treffer', () => {
    mockJobs.mockReturnValue({ data: [job()], isLoading: false, isError: false });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /failed|fehlgeschlagen/i }));

    expect(screen.getByText(/no jobs in this filter|keine aufträge in diesem filter/i)).toBeInTheDocument();
  });
});
