import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RemoteSourcesPage from './RemoteSourcesPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import '@/i18n';

const { mockQuery, mockRetrieve, mockToast, mockEcho } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRetrieve: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockEcho: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/api/modalities', () => ({
  modalitiesApi: { list: vi.fn(() => Promise.resolve(['ARCHIVE'])), echo: mockEcho },
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

  it('schickt den C-MOVE mit dem gewählten Ziel-AET', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    mockRetrieve.mockResolvedValue({ TargetAet: 'hst_burn2CD', Details: [{ DimseErrorStatus: 0 }] });
    renderPage();
    await queryStudies();

    fireEvent.change(screen.getByLabelText(/copy to|kopieren nach/i), { target: { value: 'hst_burn2CD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Copy$|^Kopieren$/ }));

    await waitFor(() =>
      expect(mockRetrieve).toHaveBeenCalledWith('ARCHIVE', 'q-1', 0, 'hst_burn2CD'),
    );
    // der DIMSE-Status der Gegenstelle wird angezeigt, nicht nur „ok“
    expect(await screen.findByText('0x0000')).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('meldet einen DIMSE-Fehlstatus als Fehlschlag', async () => {
    configure([{ aet: 'hst_burn2CD', label: 'HST BRENNER' }]);
    mockRetrieve.mockResolvedValue({ Details: [{ DimseErrorStatus: 0xc000 }] });
    renderPage();
    await queryStudies();
    // der C-FIND meldet „1 studies found“ — hier zählt nur der Kopier-Toast
    mockToast.success.mockClear();
    mockToast.error.mockClear();

    fireEvent.change(screen.getByLabelText(/copy to|kopieren nach/i), { target: { value: 'hst_burn2CD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Copy$|^Kopieren$/ }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(mockToast.success).not.toHaveBeenCalled();
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
});
