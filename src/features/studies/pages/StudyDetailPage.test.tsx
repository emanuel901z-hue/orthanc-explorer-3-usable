import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast, Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import StudyDetailPage from './StudyDetailPage';
import { OrthancError } from '@/lib/errors';

/* ── Hoisted mocks ───────────────────────────────────────────── */

const { mockDeleteStudyAction, mockDownloadStudyAction } = vi.hoisted(() => ({
  mockDeleteStudyAction: vi.fn(),
  mockDownloadStudyAction: vi.fn(),
}));

/* ── Module mocks ──────────────────────────────────────────────── */

vi.mock('@/actions/deleteStudy', () => ({
  deleteStudyAction: mockDeleteStudyAction,
}));

vi.mock('@/actions/downloadStudy', () => ({
  downloadStudyAction: mockDownloadStudyAction,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock('@/features/studies/hooks/use-studies', () => ({
  useStudy: vi.fn(() => ({
    data: {
      ID: 'study-001',
      id: 'study-001',
      patientName: 'Doe^John',
      patientId: 'PID-001',
      patientBirthDate: null,
      patientSex: 'M',
      studyDate: new Date('2024-01-15'),
      studyTime: '10:30',
      studyDescription: 'CT Chest',
      accessionNumber: 'ACC-001',
      studyInstanceUID: '1.2.3.4.5',
      modalities: ['CT'],
      numberOfSeries: 2,
      numberOfInstances: 20,
      diskSize: 104857600,
      labels: [],
      MainDicomTags: {},
      PatientMainDicomTags: {},
      ParentPatient: '',
      Series: [],
      Type: 'Study',
    },
    isLoading: false,
  })),
  useStudySeries: vi.fn(() => ({ data: [] })),
  useInstancePreview: vi.fn(() => ({ data: null, isLoading: false })),
  useStudySharedTags: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/features/audit/hooks/use-audit-log', () => ({
  useAuditLog: vi.fn(() => ({ audit: vi.fn() })),
}));

vi.mock('@/shared/hooks/use-tab-label', () => ({
  useTabLabel: vi.fn(),
}));

// Mock heavy sub-components to keep the test focused
vi.mock('@/features/studies/components/SendStudyDialog', () => ({
  default: () => null,
}));

vi.mock('@/features/studies/components/AnonymizeDialog', () => ({
  AnonymizeDialog: () => null,
}));

vi.mock('@/features/studies/components/ModifyStudyDialog', () => ({
  ModifyStudyDialog: () => null,
}));

vi.mock('@/features/studies/components/MigrateStudyDialog', () => ({
  default: () => null,
}));

vi.mock('@/features/studies/components/DicomTagBrowser', () => ({
  default: () => null,
}));

vi.mock('@/features/studies/components/StudyActivityLog', () => ({
  default: () => null,
}));

vi.mock('@/config/features', () => ({
  useFeature: vi.fn(() => true),
}));

vi.mock('@/api/tools', () => ({
  toolsApi: { createArchive: vi.fn() },
}));

/* ── Helpers ───────────────────────────────────────────────────── */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/studies/study-001']}>
          <Routes>
            <Route path="/studies/:studyId" element={<StudyDetailPage />} />
          </Routes>
          <Toaster />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

/* ── Tests ─────────────────────────────────────────────────────── */

describe('StudyDetailPage — mutation error handlers', () => {
  beforeEach(() => {
    mockDeleteStudyAction.mockReset();
    mockDownloadStudyAction.mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it('shows a toast with correlation ID when delete mutation fails', async () => {
    const orthancErr = new OrthancError(500, 'corr-abc-123', 'The server encountered an error.');
    mockDeleteStudyAction.mockRejectedValue(orthancErr);

    renderPage();

    // i18n keys are returned as-is in test env: t('actions.delete')
    const deleteButton = screen.getByRole('button', { name: /actions\.delete/i });
    act(() => {
      fireEvent.click(deleteButton);
    });

    // Confirm in the dialog
    // i18n keys are returned as-is in test env: t('studies.deletePermanently')
    const confirmButton = await screen.findByRole('button', { name: /studies\.deletePermanently/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('corr-abc-123'),
      );
    });
  });

  it('shows a toast with correlation ID when download mutation fails', async () => {
    const orthancErr = new OrthancError(500, 'corr-xyz-789', 'The server encountered an error.');
    mockDownloadStudyAction.mockRejectedValue(orthancErr);

    renderPage();

    // i18n keys are returned as-is in test env: t('actions.download')
    const downloadButton = screen.getByRole('button', { name: /actions\.download/i });
    await act(async () => {
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('corr-xyz-789'),
      );
    });
  });

  it('shows a toast without correlation ID when download fails with a generic error', async () => {
    mockDownloadStudyAction.mockRejectedValue(new Error('Network error'));

    renderPage();

    const downloadButton = screen.getByRole('button', { name: /actions\.download/i });
    await act(async () => {
      fireEvent.click(downloadButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Download failed.');
    });
  });

  it('shows a toast without correlation ID when delete fails with a generic error', async () => {
    mockDeleteStudyAction.mockRejectedValue(new Error('Network error'));

    renderPage();

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    act(() => {
      fireEvent.click(deleteButton);
    });

    // i18n keys are returned as-is in test env: t('studies.deletePermanently')
    const confirmButton = await screen.findByRole('button', { name: /studies\.deletePermanently/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to delete study.');
    });
  });
});
