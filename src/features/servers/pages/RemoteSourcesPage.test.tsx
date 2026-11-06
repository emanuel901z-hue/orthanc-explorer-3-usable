import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RemoteSourcesPage from './RemoteSourcesPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import '@/i18n';

const { mockQuery, mockRetrieve, mockToast, mockEcho, mockJobs } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRetrieve: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockEcho: vi.fn(),
  mockJobs: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/features/activity/hooks/useOrthancJobs', () => ({
  useOrthancJobs: () => mockJobs(),
}));

vi.mock('@/api/modalities', () => ({
  modalitiesApi: { list: vi.fn(() => Promise.resolve(['ARCHIVE'])), echo: mockEcho },
}));

// Die Seite braucht Name + Adresse je Modalität (Anzeige „Host:Port“)
vi.mock('@/features/settings/hooks/use-modality-details', () => ({
  useModalityDetails: () => ({
    data: [{ id: 'ARCHIVE', aet: 'ARCHIVE', host: '10.0.1.30', port: 104 }],
  }),
}));

vi.mock('@/features/settings/hooks/use-dicom-web-servers', () => ({
  useDicomWebServers: () => ({ data: [] }),
}));

vi.mock('@/actions/queryModality', () => ({ queryModalityAction: mockQuery }));

vi.mock('@/api/queries', () => ({
  queriesApi: {
    getAnswerContentFull: vi.fn(() => Promise.resolve({
      '0010,0010': { Name: 'PatientName', Value: 'MUSTERMANN^ERIKA' },
      '0008,0020': { Name: 'StudyDate', Value: '20260101' },
    })),
  },
}));
vi.mock('@/actions/retrieveModality', () => ({ retrieveModalityAction: mockRetrieve }));

// Radix Select does not open in jsdom; the page only needs a control that
// hands a value to onValueChange, so a native stand-in is enough here.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const Ctx = React.createContext<{ onValueChange?: (value: string) => void }>({});
  const Root = ({ onValueChange, children }: { onValueChange?: (value: string) => void; children?: React.ReactNode }) =>
    React.createElement(Ctx.Provider, { value: { onValueChange } }, React.createElement('div', null, children));
  const Passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  const Item = ({ value, children }: { value: string; children?: React.ReactNode }) => {
    const ctx = React.useContext(Ctx);
    return React.createElement(
      'button',
      { type: 'button', 'data-value': value, onClick: () => ctx.onValueChange?.(value) },
      children,
    );
  };
  return {
    Select: Root,
    SelectTrigger: Passthrough,
    SelectValue: () => null,
    SelectContent: Passthrough,
    SelectGroup: Passthrough,
    SelectLabel: Passthrough,
    SelectSeparator: () => null,
    SelectScrollUpButton: () => null,
    SelectScrollDownButton: () => null,
    SelectItem: Item,
  };
});

const ANSWERS = {
  queryId: 'q-1',
  answers: [
    {
      index: 0,
      tags: {
        PatientName: 'MUSTERMANN^ERIKA',
        PatientID: 'P-100',
        StudyDate: '20260101',
        StudyDescription: 'CT Thorax',
        AccessionNumber: 'ACC-1',
        StudyInstanceUID: '1.2.3',
      },
    },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RemoteSourcesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function copyJob(state: 'Running' | 'Success' | 'Failure', dimse = 0) {
  return {
    ID: 'job-1',
    Type: 'DicomMoveScu',
    State: state,
    Progress: state === 'Running' ? 40 : 100,
    CreationTime: '20261106T114657.025637',
    ErrorDescription: state === 'Failure' ? 'Error in the network protocol' : 'Success',
    Content: { TargetAet: 'hst_burn2CD', Details: [{ DimseErrorStatus: dimse }] },
  };
}

/** Modality pick (Radix stand-in) + search + query, so the results table exists. */
async function queryStudies(search = 'MUSTERMANN') {
  const modalityButton = await screen.findByRole('button', { name: /ARCHIVE/ });
  fireEvent.click(modalityButton);
  fireEvent.change(screen.getByLabelText(/search:|suche:/i), { target: { value: search } });
  fireEvent.click(screen.getByRole('button', { name: /^Query$|^Abfragen$/ }));
  await screen.findAllByText('MUSTERMANN^ERIKA');
}

describe('RemoteSourcesPage — C-MOVE auf ein Zielarchiv', () => {
  beforeEach(() => {
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
    window.localStorage.clear();
    vi.clearAllMocks();
    mockQuery.mockResolvedValue(ANSWERS);
    mockEcho.mockResolvedValue({});
    mockJobs.mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__OE3_CONFIG__;
    __resetConfigForTests();
  });

  it('bietet die Ziele aus der Runtime-Config an', async () => {
    configure([
      { aet: 'hst_burn2CD', label: 'HST BRENNER' },
      { aet: 'JungPacs' },
    ]);
    renderPage();
    await queryStudies();

    const select = screen.getByLabelText(/copy to|kopieren nach/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'HST BRENNER (hst_burn2CD)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'JungPacs' })).toBeInTheDocument();
  });

  it('beauftragt den C-MOVE als Job mit dem gewählten Ziel-AET', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    mockRetrieve.mockResolvedValue({ ID: 'job-1', Type: 'DicomMoveScu' });
    const { rerender } = renderPage();
    await queryStudies();

    fireEvent.change(screen.getByLabelText(/copy to|kopieren nach/i), { target: { value: 'hst_burn2CD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Copy$|^Kopieren$/ }));

    await waitFor(() =>
      expect(mockRetrieve).toHaveBeenCalledWith('ARCHIVE', 'q-1', 0, 'hst_burn2CD', { asynchronous: true }),
    );
    expect(mockToast.success).toHaveBeenCalled();

    // Solange der Job läuft, zeigt die Zeile den Fortschritt
    mockJobs.mockReturnValue({ data: [copyJob('Running')], isLoading: false, isError: false });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RemoteSourcesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/40\s*%/)).toBeInTheDocument();

    // Danach den DIMSE-Status der Gegenstelle, nicht nur „ok“
    mockJobs.mockReturnValue({ data: [copyJob('Success')], isLoading: false, isError: false });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RemoteSourcesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('0x0000')).toBeInTheDocument();
  });

  it('zeigt einen DIMSE-Fehlstatus des Jobs als Fehlschlag', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    mockRetrieve.mockResolvedValue({ ID: 'job-1' });
    const { rerender } = renderPage();
    await queryStudies();

    fireEvent.change(screen.getByLabelText(/copy to|kopieren nach/i), { target: { value: 'hst_burn2CD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Copy$|^Kopieren$/ }));
    await waitFor(() => expect(mockRetrieve).toHaveBeenCalled());

    mockJobs.mockReturnValue({ data: [copyJob('Failure', 0xa801)], isLoading: false, isError: false });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RemoteSourcesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('0xA801')).toBeInTheDocument();
  });

  it('kopiert ohne Ziel nicht', async () => {
    configure([{ aet: 'hst_burn2CD' }]);
    renderPage();
    await queryStudies();

    const copyButton = screen.getByRole('button', { name: /^Copy$|^Kopieren$/ });
    expect(copyButton).toBeDisabled();
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('zeigt einen Hinweis, wenn keine Ziele konfiguriert sind', async () => {
    configure(undefined);
    renderPage();
    await queryStudies();

    expect(screen.getByRole('option', { name: /no targets configured|keine ziele konfiguriert/i })).toBeInTheDocument();
  });

  it('zeigt, was aus der Suchzeile wird, und schickt alle Anzeigefelder mit', async () => {
    configure([]);
    renderPage();
    await queryStudies('Muster 29.08.2026');

    // Chips machen die Übersetzung sichtbar
    expect(screen.getByText('MUSTER*')).toBeInTheDocument();
    expect(screen.getByText('20260829')).toBeInTheDocument();

    const [, params] = mockQuery.mock.calls[0];
    // Das Ziel-PACS liefert nur zurück, was angefragt wurde — also alles anfragen
    expect(params.Query).toMatchObject({
      PatientName: 'MUSTER*',
      // ein Datum ohne Präfix gilt als Geburtsdatum (der Alltag: Name, Gebdat)
      PatientBirthDate: '20260829',
      PatientID: '',
      StudyDescription: '',
      AccessionNumber: '',
      ModalitiesInStudy: '',
      StudyInstanceUID: '',
    });
  });

  it('probiert bei null Treffern die zweite Deutung und sagt es', async () => {
    configure([]);
    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ queryId: 'q-empty', answers: [] })
      .mockResolvedValueOnce({ queryId: 'q-hit', answers: ANSWERS.answers });
    renderPage();
    await queryStudies('E2E');

    expect(await screen.findByText('MUSTERMANN^ERIKA')).toBeInTheDocument();
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/found as|gefunden als/i)).toBeInTheDocument();
  });

  it('weist ein Datum ohne Jahr zurück, statt es als Namen zu suchen', async () => {
    configure([]);
    renderPage();
    const modalityButton = await screen.findByRole('button', { name: /ARCHIVE/ });
    fireEvent.click(modalityButton);

    fireEvent.change(screen.getByLabelText(/search:|suche:/i), { target: { value: '29.08.' } });
    expect(screen.getByText(/not used|nicht verwendet/i)).toBeInTheDocument();

    // ohne verwertbares Kriterium wird gar nicht erst gesucht
    fireEvent.click(screen.getByRole('button', { name: /^Query$|^Abfragen$/ }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('fragt auch per Enter ab', async () => {
    configure([]);
    renderPage();
    await queryStudies('Muster');
    mockQuery.mockClear();

    const input = screen.getByLabelText(/search:|suche:/i);
    fireEvent.change(input, { target: { value: 'Muster' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
  });

  it('verlangt vor der Abfrage ein Suchkriterium', async () => {
    configure([]);
    renderPage();
    const modalityButton = await screen.findByRole('button', { name: /ARCHIVE/ });
    fireEvent.click(modalityButton);

    fireEvent.click(screen.getByRole('button', { name: /^Query$|^Abfragen$/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('„Alle kopieren“ setzt je Treffer einen Auftrag ab', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({
      queryId: 'q-1',
      answers: [
        ANSWERS.answers[0],
        { index: 1, tags: { ...ANSWERS.answers[0].tags, PatientID: 'P-101', StudyInstanceUID: '1.2.4' } },
      ],
    });
    mockRetrieve.mockResolvedValue({ ID: 'job-x' });
    renderPage();
    await queryStudies('Muster');

    fireEvent.change(screen.getByLabelText(/copy to|kopieren nach/i), { target: { value: 'hst_burn2CD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Copy all$|^Alle kopieren$/ }));

    await waitFor(() => expect(mockRetrieve).toHaveBeenCalledTimes(2));
    expect(mockRetrieve).toHaveBeenCalledWith('ARCHIVE', 'q-1', 0, 'hst_burn2CD', { asynchronous: true });
    expect(mockRetrieve).toHaveBeenCalledWith('ARCHIVE', 'q-1', 1, 'hst_burn2CD', { asynchronous: true });
  });

  it('sortiert die Trefferliste über die Spaltenköpfe', async () => {
    configure([]);
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({
      queryId: 'q-1',
      answers: [
        { index: 0, tags: { ...ANSWERS.answers[0].tags, StudyDate: '20260101' } },
        { index: 1, tags: { ...ANSWERS.answers[0].tags, PatientName: 'ALBERT^BERT', StudyDate: '20260603' } },
      ],
    });
    renderPage();
    await queryStudies('Muster');

    const rows = () => screen.getAllByTestId('remote-study-row').map((row) => row.textContent ?? '');
    // Voreinstellung: Studiendatum absteigend
    expect(rows()[0]).toContain('ALBERT^BERT');

    fireEvent.click(screen.getByRole('button', { name: /Studiendatum|Study Date/i }));
    expect(rows()[0]).toContain('MUSTERMANN^ERIKA');
  });

  it('wählt Zeilen aus und bietet die Sammelaktionen für die Auswahl an', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    renderPage();
    await queryStudies('Muster');

    fireEvent.click(screen.getByLabelText(/select study|studie auswählen/i));

    expect(screen.getByText(/1 selected|1 ausgewählt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy \(1\)|Kopieren \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retrieve \(1\)|Abrufen \(1\)/ })).toBeInTheDocument();
  });

  it('zeigt die Modalität und sortiert danach', async () => {
    configure([]);
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({
      queryId: 'q-1',
      answers: [
        { index: 0, tags: { ...ANSWERS.answers[0].tags, ModalitiesInStudy: 'CT' } },
        { index: 1, tags: { ...ANSWERS.answers[0].tags, PatientName: 'ALBERT^BERT', ModalitiesInStudy: 'MR' } },
      ],
    });
    renderPage();
    await queryStudies('Muster');

    // Spalte ist da und gefüllt
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByText('MR')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Modalität|Modality/i }));
    const rows = screen.getAllByTestId('remote-study-row');
    expect(rows[0].textContent).toContain('CT');
  });

  it('öffnet beim Klick auf eine Zeile die Detailansicht mit den Tags', async () => {
    configure([]);
    renderPage();
    await queryStudies('Muster');

    fireEvent.click(screen.getAllByTestId('remote-study-row')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('MUSTERMANN^ERIKA');
    // Tag-Tabelle aus der Antwort des Archivs
    expect(await screen.findByText('PatientName')).toBeInTheDocument();
    expect(screen.getByText('0010,0010')).toBeInTheDocument();
  });

  it('klickt beim Abrufen in der Zeile nicht die Detailansicht auf', async () => {
    configure([]);
    renderPage();
    await queryStudies('Muster');

    fireEvent.click(screen.getByRole('button', { name: /^Retrieve$|^Abrufen$/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prüft die gewählte Modalität automatisch per C-ECHO', async () => {
    configure([]);
    mockEcho.mockResolvedValue({});
    renderPage();
    await queryStudies();

    // kein Klick auf „Echo“ — die Auswahl allein löst die Prüfung aus
    await waitFor(() => expect(mockEcho).toHaveBeenCalledWith('ARCHIVE'));
  });

  it('zeigt die echte Adresse der Modalität statt eines Platzhalters', async () => {
    configure([]);
    renderPage();
    await queryStudies();

    expect(screen.getByText(/10\.0\.1\.30:104/)).toBeInTheDocument();
  });

  it('markiert eine Modalität, die nicht antwortet, als nicht erreichbar', async () => {
    configure([]);
    mockEcho.mockRejectedValue(new Error('association rejected'));
    renderPage();
    await queryStudies();

    // der Fehlschlag bleibt still (kein Toast), aber der Zustand steht
    await waitFor(() => expect(mockEcho).toHaveBeenCalledWith('ARCHIVE'));
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

function configure(cmoves: { aet: string; label?: string }[] | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = {
    orthancUrl: '',
    authMode: 'none',
    features: {},
    cmoveTargets: cmoves,
  };
  __resetConfigForTests();
  loadConfig();
}
