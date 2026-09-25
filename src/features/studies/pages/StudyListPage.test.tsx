import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';

vi.mock('@/features/studies/hooks/use-studies', () => ({
  useStudies: () => ({ data: [], isLoading: false, isFetching: false }),
}));
vi.mock('@/api/system', () => ({ systemApi: { get: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/api/tools', () => ({
  toolsApi: {
    getLabels: vi.fn().mockResolvedValue([]),
    countStudiesByLabel: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock('@/features/settings/hooks/use-modalities', () => ({
  useModalities: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/features/studies/components/SendStudyDialog', () => ({ default: () => null }));
vi.mock('@/features/studies/components/QuickReportDialog', () => ({ default: () => null }));
vi.mock('@/features/studies/components/QuarantineDialog', () => ({ default: () => null }));
vi.mock('@/features/studies/components/StudyLabelDialog', () => ({ default: () => null }));

import StudyListPage from './StudyListPage';
import { DEFAULT_COLUMN_VISIBILITY } from './study-list-defaults';
import { usePersistedUiStore, useSessionUiStore } from '@/store/ui-state';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';

function renderPage(entry = '/studies') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <StudyListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StudyListPage — persisted UI state', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', features: {} };
    loadConfig();
    usePersistedUiStore.setState({ values: {} });
    useSessionUiStore.setState({ values: {} });
  });

  afterEach(() => __resetConfigForTests());

  it('mounts and renders the list', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Studies' })).toBeInTheDocument();
  });

  it('honours the persisted column visibility', () => {
    // studyInstanceUID is hidden by default …
    const { unmount } = renderPage();
    expect(screen.queryByText('Study Instance UID')).not.toBeInTheDocument();
    unmount();

    // … and shows up once the stored layout says so
    usePersistedUiStore.setState({
      values: { 'studies.columnVisibility': { ...DEFAULT_COLUMN_VISIBILITY, studyInstanceUID: true } },
    });
    renderPage();
    expect(screen.getByText('Study Instance UID')).toBeInTheDocument();
  });

  it('lays the columns out automatically and applies the dragged width on top', () => {
    // jsdom has no layout, so the automatic layout falls back to the minimum
    // widths; the important part is that fixed layout + an explicit pixel width
    // is what makes resizing work at all.
    usePersistedUiStore.setState({ values: { 'studies.columnWidths': { patientName: 333 } } });
    const { container } = renderPage();
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table!.style.tableLayout).toBe('fixed');
    expect(table!.style.width).toMatch(/^\d+px$/);

    const patientNameHeader = screen.getByText('Patient Name').closest('th');
    expect(patientNameHeader?.style.width).toBe('333px');
  });

  it('offers "auto widths" once a column was dragged, and resets to automatic', () => {
    usePersistedUiStore.setState({ values: { 'studies.columnWidths': { patientName: 333 } } });
    const { container } = renderPage();

    // no manual widths → nothing to reset
    expect(screen.queryByText('Auto widths')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /columns/i }));
    const reset = screen.getByText('Auto widths');
    expect(reset).toBeInTheDocument();

    fireEvent.click(reset);
    const patientNameHeader = container.querySelector('table th:nth-child(2)') as HTMLTableCellElement;
    expect(patientNameHeader.style.width).not.toBe('333px');
    expect(usePersistedUiStore.getState().values['studies.columnWidths']).toEqual({});
  });
});
