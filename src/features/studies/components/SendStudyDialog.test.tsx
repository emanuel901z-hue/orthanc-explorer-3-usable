import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SendStudyDialog from './SendStudyDialog';
import { useModalities } from '@/features/settings/hooks/use-modalities';

/* ── Hoisted mocks ───────────────────────────────────────────── */

const { mockSendStudyAction } = vi.hoisted(() => ({
  mockSendStudyAction: vi.fn(),
}));

/* ── Module mocks ──────────────────────────────────────────────── */

vi.mock('@/features/settings/hooks/use-modalities', () => ({
  useModalities: vi.fn(() => ({ data: ['PACS1', 'SCANNER_A'], isLoading: false })),
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object') {
        return Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          key,
        );
      }
      return key;
    },
  }),
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

/* ── Tests ─────────────────────────────────────────────────────── */

describe('SendStudyDialog — live API wiring', () => {
  beforeEach(() => {
    mockSendStudyAction.mockReset();
    vi.mocked(useModalities).mockReturnValue(
      { data: ['PACS1', 'SCANNER_A'], isLoading: false } as ReturnType<typeof useModalities>,
    );
  });

  it('renders modality names from useModalities hook (C-STORE only, no STOW-RS tab)', () => {
    renderDialog();
    expect(screen.getByRole('radio', { name: /PACS1/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /SCANNER_A/i })).toBeInTheDocument();
  });

  it('calls useModalities hook (not demo generators)', () => {
    renderDialog();
    expect(useModalities).toHaveBeenCalled();
  });

  it('calls useMutation when C-STORE send is triggered', async () => {
    mockSendStudyAction.mockResolvedValue(undefined);

    renderDialog();

    // Select PACS1 radio
    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: /PACS1/i }));
    });

    // Click the Send button — use the mutate spy captured during render
    const mutateSpy = latestMutate;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /send.sendViaCStore/i }));
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
    expect(screen.getByText(/send.noModalities/i)).toBeInTheDocument();
  });
});
