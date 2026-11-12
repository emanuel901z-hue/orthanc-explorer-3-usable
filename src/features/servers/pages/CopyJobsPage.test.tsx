import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CopyJobsPage from './CopyJobsPage';
import { jobsApi, type OrthancJob } from '@/api/jobs';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import i18n from '@/i18n';

const { mockJobs, mockJournal, mockHidden, mockHide, mockShow, mockDeleteJob } = vi.hoisted(() => ({
  mockJobs: vi.fn(),
  mockJournal: vi.fn(() => Promise.resolve([])),
  mockHidden: vi.fn(() => Promise.resolve([])),
  mockHide: vi.fn(() => Promise.resolve([])),
  mockShow: vi.fn(() => Promise.resolve([])),
  mockDeleteJob: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/features/activity/hooks/useOrthancJobs', () => ({
  useOrthancJobs: () => mockJobs(),
}));

vi.mock('@/api/copy-journal', () => ({
  copyJournalApi: {
    list: mockJournal,
    record: vi.fn(() => Promise.resolve({})),
    remove: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock('@/api/hidden-jobs', () => ({
  hiddenJobsApi: { list: mockHidden, hide: mockHide, show: mockShow },
}));

vi.mock('@/actions/deleteJob', () => ({ deleteJobAction: mockDeleteJob }));
vi.mock('@/actions/hideCopyJobs', () => ({
  hideCopyJobsAction: mockHide,
  showCopyJobsAction: mockShow,
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CopyJobsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CopyJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournal.mockResolvedValue([]);
    mockHidden.mockResolvedValue([]);
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

  it('zeigt Start, Ende und die Bedeutung des DIMSE-Status', async () => {
    await i18n.changeLanguage('de');
    mockJobs.mockReturnValue({
      data: [job({
        CreationTime: '20261106T114657.025637',
        CompletionTime: '20261106T114703.029587',
        EffectiveRuntime: 6,
      })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Ende')).toBeInTheDocument();
    expect(screen.getByText('06.11.2026, 11:46')).toBeInTheDocument();
    expect(screen.getByText('06.11.2026, 11:47')).toBeInTheDocument();
    // Klartext steht in der Zelle, der Code klein darunter
    expect(screen.getByText('alles zugestellt')).toBeInTheDocument();
    expect(screen.getByText('0x0000')).toBeInTheDocument();
  });

  it('zeigt einen laufenden Auftrag ohne Endzeit', async () => {
    await i18n.changeLanguage('de');
    mockJobs.mockReturnValue({
      data: [job({ State: 'Running', Progress: 30, CompletionTime: undefined })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('läuft…')).toBeInTheDocument();
  });

  it('markiert einen Teilfehler als Warnung, nicht als Erfolg', async () => {
    await i18n.changeLanguage('de');
    mockJobs.mockReturnValue({
      data: [job({ Content: { TargetAet: 'X', Details: [{ DimseErrorStatus: 0xb000 }] } })],
      isLoading: false,
      isError: false,
    });

    renderPage();

    // Filterknopf und Status-Badge tragen beide das Label
    expect(screen.getAllByText('teilweise zugestellt').length).toBeGreaterThan(1);
    // „teilweise zugestellt“ steht als Badge und als Bedeutung — beide zählen
    expect(screen.getAllByText('teilweise zugestellt').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('0xB000')).toBeInTheDocument();
    // nicht als „zugestellt“ zählen
    expect(screen.getByRole('button', { name: /^sauber zugestellt/i })).toHaveTextContent('(0)');
  });

  it('erklärt einen Filter ohne Treffer', () => {
    mockJobs.mockReturnValue({ data: [job()], isLoading: false, isError: false });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /failed|fehlgeschlagen/i }));

    expect(screen.getByText(/no jobs in this filter|keine aufträge in diesem filter/i)).toBeInTheDocument();
  });

  it('löst den Ziel-AET in seinen Klartext-Alias auf und filtert über das Suchfeld', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '',
      authMode: 'none',
      features: {},
      cmoveTargets: [{ aet: 'hst_burn2CD', label: 'HST BRENNER' }],
    };
    __resetConfigForTests();
    loadConfig();

    mockJobs.mockReturnValue({
      data: [
        job(),
        job({
          ID: 'job-2',
          Content: {
            RemoteAet: 'ARCHIVE',
            TargetAet: 'JIVEXTELE',
            Query: [{ '0020,000d': '9.9.9', '0010,0020': 'P-999' }],
            Details: [{ DimseErrorStatus: 0 }],
          },
        }),
      ],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('HST BRENNER')).toBeInTheDocument();
    expect(screen.getByText('hst_burn2CD')).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/filter by|filtern/i);
    fireEvent.change(searchInput, { target: { value: 'HST BRENNER' } });

    expect(screen.getByText('P-100')).toBeInTheDocument();
    expect(screen.queryByText('P-999')).not.toBeInTheDocument();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__OE3_CONFIG__;
    __resetConfigForTests();
  });

  it('startet einen fehlgeschlagenen Auftrag per Klick neu', async () => {
    const resubmitSpy = vi.spyOn(jobsApi, 'resubmit').mockResolvedValue({});
    mockJobs.mockReturnValue({
      data: [job({ ID: 'job-fail', State: 'Failure', Content: { TargetAet: 'X', Details: [{ DimseErrorStatus: 0xa801 }] } })],
      isLoading: false,
      isError: false,
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /retry job|auftrag erneut senden/i }));

    await waitFor(() => expect(resubmitSpy).toHaveBeenCalledWith('job-fail'));
    resubmitSpy.mockRestore();
  });

  it('zeigt Patientenname und Geburtsdatum aus dem Kopier-Journal', async () => {
    await i18n.changeLanguage('de');
    mockJournal.mockResolvedValue([
      {
        jobId: 'job-1',
        patientName: 'MUSTERMANN^ERIKA',
        patientId: 'P-100',
        birthDate: '19470803',
        studyInstanceUid: '1.2.3',
      },
    ]);
    mockJobs.mockReturnValue({ data: [job()], isLoading: false, isError: false });

    renderPage();

    // Der Job selbst kennt nur die Haupt-Tags — Name und Datum kommen aus dem Journal
    expect(await screen.findByText('MUSTERMANN^ERIKA')).toBeInTheDocument();
    expect(screen.getByText('P-100 · 03.08.1947')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
  });

  it('findet einen Auftrag über den Patientennamen', async () => {
    await i18n.changeLanguage('de');
    mockJournal.mockResolvedValue([
      { jobId: 'job-1', patientName: 'MUSTERMANN^ERIKA', patientId: 'P-100', birthDate: '19470803' },
      { jobId: 'job-2', patientName: 'BEISPIEL^PAUL', patientId: 'P-999', birthDate: '19800202' },
    ]);
    mockJobs.mockReturnValue({
      data: [job(), job({ ID: 'job-2', Content: { TargetAet: 'JungPacs', Details: [{ DimseErrorStatus: 0 }] } })],
      isLoading: false,
      isError: false,
    });

    renderPage();
    await screen.findByText('MUSTERMANN^ERIKA');

    fireEvent.change(screen.getByLabelText(/filtern|filter by/i), { target: { value: 'beispiel' } });

    expect(screen.getByText('BEISPIEL^PAUL')).toBeInTheDocument();
    expect(screen.queryByText('MUSTERMANN^ERIKA')).not.toBeInTheDocument();
  });

  it('findet einen Auftrag über das Geburtsdatum — roh und in der Anzeigeschreibweise', async () => {
    await i18n.changeLanguage('de');
    mockJournal.mockResolvedValue([
      { jobId: 'job-1', patientName: 'MUSTERMANN^ERIKA', patientId: 'P-100', birthDate: '19470803' },
      { jobId: 'job-2', patientName: 'BEISPIEL^PAUL', patientId: 'P-999', birthDate: '19800202' },
    ]);
    mockJobs.mockReturnValue({
      data: [job(), job({ ID: 'job-2', Content: { TargetAet: 'JungPacs', Details: [{ DimseErrorStatus: 0 }] } })],
      isLoading: false,
      isError: false,
    });

    renderPage();
    await screen.findByText('MUSTERMANN^ERIKA');
    const search = screen.getByLabelText(/filtern|filter by/i);

    fireEvent.change(search, { target: { value: '03.08.1947' } });
    expect(screen.getByText('MUSTERMANN^ERIKA')).toBeInTheDocument();
    expect(screen.queryByText('BEISPIEL^PAUL')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '19800202' } });
    expect(screen.getByText('BEISPIEL^PAUL')).toBeInTheDocument();
    expect(screen.queryByText('MUSTERMANN^ERIKA')).not.toBeInTheDocument();
  });
});

describe('CopyJobsPage — Aufräumen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournal.mockResolvedValue([]);
    mockHidden.mockResolvedValue([]);
    mockHide.mockResolvedValue([]);
    mockShow.mockResolvedValue([]);
    mockDeleteJob.mockResolvedValue(undefined);
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
    window.localStorage.clear();
  });

  function twoJobs() {
    mockJobs.mockReturnValue({
      data: [
        job(),
        job({
          ID: 'job-2',
          Content: {
            TargetAet: 'JungPacs',
            Query: [{ '0020,000d': '9.9.9', '0010,0020': 'P-999' }],
            Details: [{ DimseErrorStatus: 0 }],
          },
        }),
      ],
      isLoading: false,
      isError: false,
    });
  }

  it('blendet die ausgewählten Aufträge aus', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    renderPage();

    const checkboxes = await screen.findAllByRole('checkbox');
    // [0] ist die Kopf-Checkbox
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    fireEvent.click(screen.getByRole('button', { name: /^ausblenden \(2\)/i }));

    await waitFor(() => expect(mockHide).toHaveBeenCalledWith(['job-1', 'job-2']));
  });

  it('wählt über die Kopf-Checkbox alle sichtbaren aus', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    renderPage();

    const [master] = await screen.findAllByRole('checkbox');
    fireEvent.click(master);

    expect(screen.getByText(/2 ausgewählt/i)).toBeInTheDocument();
  });

  it('zeigt ausgeblendete Aufträge erst auf Wunsch', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    mockHidden.mockResolvedValue(['job-2']);
    renderPage();

    expect(await screen.findByText('P-100')).toBeInTheDocument();
    // die Ausblend-Liste kommt aus einem eigenen Request
    await waitFor(() => expect(screen.queryByText('P-999')).not.toBeInTheDocument());
    // ausgeblendet heißt nicht gelöscht — der Schalter holt sie zurück
    fireEvent.click(screen.getByRole('button', { name: /ausgeblendete anzeigen \(1\)/i }));

    expect(await screen.findByText('P-999')).toBeInTheDocument();
    expect(screen.getByText('ausgeblendet')).toBeInTheDocument();
  });

  it('blendet ausgeblendete Aufträge wieder ein', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    mockHidden.mockResolvedValue(['job-2']);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /ausgeblendete anzeigen \(1\)/i }));
    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByRole('button', { name: /^einblenden \(1\)/i }));

    await waitFor(() => expect(mockShow).toHaveBeenCalledWith(['job-2']));
  });

  it('löscht erst nach Rückfrage', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    renderPage();

    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /^löschen \(1\)/i }));

    // noch nichts gelöscht — die Rückfrage steht
    expect(screen.getByText(/kopieraufträge löschen\?/i)).toBeInTheDocument();
    expect(mockDeleteJob).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^löschen$/i }));

    await waitFor(() => expect(mockDeleteJob).toHaveBeenCalledWith('job-1'));
    expect(mockDeleteJob).toHaveBeenCalledTimes(1);
  });

  it('bietet für laufende Aufträge kein Löschen an', async () => {
    await i18n.changeLanguage('de');
    mockJobs.mockReturnValue({
      data: [job({ State: 'Running', Progress: 10, CompletionTime: undefined })],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(screen.getByRole('button', { name: /^löschen \(0\)/i })).toBeDisabled();
  });

  it('findet Aufträge über das Startdatum', async () => {
    await i18n.changeLanguage('de');
    twoJobs();
    renderPage();
    await screen.findByText('P-100');

    fireEvent.change(screen.getByLabelText(/filtern|filter by/i), { target: { value: '06.11.2026' } });

    // beide Jobs starteten am 06.11.2026
    expect(screen.getByText('P-100')).toBeInTheDocument();
    expect(screen.getByText('P-999')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filtern|filter by/i), { target: { value: '07.11.2026' } });
    expect(screen.queryByText('P-100')).not.toBeInTheDocument();
  });
});
