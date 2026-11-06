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

/** Modality pick (Radix stand-in) + query, so the results table exists. */
async function queryStudies() {
  const modalityButton = await screen.findByRole('button', { name: /ARCHIVE/ });
  fireEvent.click(modalityButton);
  fireEvent.click(screen.getByRole('button', { name: /^Query$|^Abfragen$/ }));
  await screen.findByText('MUSTERMANN^ERIKA');
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
