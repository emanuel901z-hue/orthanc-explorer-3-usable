import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SendStudyDialog from './SendStudyDialog';
import { useModalities } from '@/features/settings/hooks/use-modalities';
import { useDicomWebServers } from '@/features/settings/hooks/use-dicom-web-servers';

/* ── Hoisted mocks ───────────────────────────────────────────── */

const { mockSendStudyAction } = vi.hoisted(() => ({
  mockSendStudyAction: vi.fn(),
}));

/* ── Module mocks ──────────────────────────────────────────────── */

vi.mock('@/features/settings/hooks/use-modalities', () => ({
  useModalities: vi.fn(() => ({ data: ['PACS1', 'SCANNER_A'], isLoading: false })),
}));

vi.mock('@/features/settings/hooks/use-dicom-web-servers', () => ({
  useDicomWebServers: vi.fn(() => ({ data: ['CloudPACS', 'ResearchArchive'], isLoading: false })),
}));

vi.mock('@/actions/sendStudy', () => ({
  sendStudyAction: mockSendStudyAction,
}));

vi.mock('@/api/modalities', () => ({
  modalitiesApi: {
    get: vi.fn((name: string) =>
      Promise.resolve({ AET: `${name}_AET`, Host: '10.0.0.1', Port: 104 }),
    ),
  },
}));

vi.mock('@/api/dicomWebServers', () => ({
  dicomWebServersApi: {
    list: vi.fn(() => Promise.resolve(['CloudPACS', 'ResearchArchive'])),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// useMutation mock — stable, uses a per-call mutate spy captured via let
let latestMutate = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: vi.fn(({ mutationFn }: { mutationFn: (...args: unknown[]) => unknown }) => {
      latestMutate = vi.fn((...args: unknown[]) => mutationFn(...args));
      return { mutate: latestMutate, isPending: false };
    }),
  };
});

/* ── Helpers ───────────────────────────────────────────────────── */

const defaultStudies = [
  { id: 'study-001', patientName: 'Doe^John', studyDescription: 'CT Chest' },
];

function renderDialog() {
  return render(
    <SendStudyDialog open={true} onOpenChange={vi.fn()} studies={defaultStudies} />,
  );
}

/**
 * Switches to the C-STORE tab.
 * Radix UI Tabs requires the full pointer event sequence (mouseDown + mouseUp + click)
 * to update tab state in jsdom, in addition to wrapping in act().
 */
function switchToCStore() {
  const tab = screen.getByRole('tab', { name: /c-store/i });
  act(() => {
    fireEvent.mouseDown(tab);
    fireEvent.mouseUp(tab);
    fireEvent.click(tab);
  });
}

/* ── Tests ─────────────────────────────────────────────────────── */

describe('SendStudyDialog — live API wiring', () => {
  beforeEach(() => {
    mockSendStudyAction.mockReset();
    vi.mocked(useModalities).mockReturnValue(
      { data: ['PACS1', 'SCANNER_A'], isLoading: false } as ReturnType<typeof useModalities>,
    );
    vi.mocked(useDicomWebServers).mockReturnValue(
      { data: ['CloudPACS', 'ResearchArchive'], isLoading: false } as ReturnType<typeof useDicomWebServers>,
    );
  });

  it('renders modality names from useModalities hook in C-STORE tab', () => {
    renderDialog();
    switchToCStore();
    expect(screen.getByRole('radio', { name: /PACS1/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /SCANNER_A/i })).toBeInTheDocument();
  });

  it('renders DICOMweb server names from useDicomWebServers hook in STOW-RS tab', () => {
    renderDialog();
    // STOW-RS is the default tab
    expect(screen.getByRole('radio', { name: /CloudPACS/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ResearchArchive/i })).toBeInTheDocument();
  });

  it('calls useModalities and useDicomWebServers hooks (not demo generators)', () => {
    renderDialog();
    expect(useModalities).toHaveBeenCalled();
    expect(useDicomWebServers).toHaveBeenCalled();
  });

  it('calls useMutation when C-STORE send is triggered', async () => {
    mockSendStudyAction.mockResolvedValue(undefined);

    renderDialog();
    switchToCStore();

    // Select PACS1 radio
    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: /PACS1/i }));
    });

    // Click the Send button — use the mutate spy captured during render
    const mutateSpy = latestMutate;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /send via c-store/i }));
    });

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith({ resourceIds: ['study-001'], target: 'PACS1' });
    });
  });

  it('shows loading state while modality data is being fetched without crashing', () => {
    vi.mocked(useModalities).mockReturnValueOnce(
      { data: undefined, isLoading: true } as ReturnType<typeof useModalities>,
    );
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows empty state when no modalities are configured', () => {
    vi.mocked(useModalities).mockReturnValue(
      { data: [], isLoading: false } as ReturnType<typeof useModalities>,
    );
    renderDialog();
    switchToCStore();
    expect(screen.getByText(/no dicom modalities configured/i)).toBeInTheDocument();
  });

  it('shows empty state when no DICOMweb servers are configured', () => {
    vi.mocked(useDicomWebServers).mockReturnValue(
      { data: [], isLoading: false } as ReturnType<typeof useDicomWebServers>,
    );
    renderDialog();
    expect(screen.getByText(/no dicomweb servers/i)).toBeInTheDocument();
  });
});
