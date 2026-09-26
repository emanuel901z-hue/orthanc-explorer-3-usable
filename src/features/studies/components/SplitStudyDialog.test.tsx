import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SplitStudyDialog } from './SplitStudyDialog';
import '@/i18n';

const { mockSplit } = vi.hoisted(() => ({ mockSplit: vi.fn() }));

vi.mock('@/actions/splitStudy', () => ({
  splitStudyAction: mockSplit,
}));

const mockStudy = {
  id: 'study-1',
  patientName: 'Demo^Patient',
  patientId: 'P001',
  studyDate: new Date('2026-01-01'),
  studyDescription: 'CT Thorax',
  accessionNumber: 'ACC123',
  studyInstanceUID: '1.2.3.4.5',
  modalities: ['CT'],
  numberOfSeries: 2,
  numberOfInstances: 20,
  isStable: true,
  labels: [],
  lastUpdate: new Date('2026-01-01'),
};

const mockSeriesList = [
  {
    id: 'series-1',
    studyId: 'study-1',
    seriesNumber: 1,
    seriesDescription: 'Scout',
    modality: 'CT',
    numberOfInstances: 2,
    seriesInstanceUID: '1.2.3.4.5.1',
    firstInstanceId: 'inst-1',
  },
  {
    id: 'series-2',
    studyId: 'study-1',
    seriesNumber: 2,
    seriesDescription: 'Thin Slices',
    modality: 'CT',
    numberOfInstances: 18,
    seriesInstanceUID: '1.2.3.4.5.2',
    firstInstanceId: 'inst-2',
  },
];

function renderDialog(open = true, preselected?: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SplitStudyDialog
          open={open}
          onOpenChange={() => {}}
          study={mockStudy}
          seriesList={mockSeriesList}
          preselectedSeriesIds={preselected}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SplitStudyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders series list with checkboxes', () => {
    renderDialog();
    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText('Thin Slices')).toBeInTheDocument();
  });

  it('splits selected series when submitted', async () => {
    mockSplit.mockResolvedValue({
      TargetStudy: 'target-split-study',
      TargetStudyUID: '1.2.3.999',
      InstancesCount: 2,
    });

    renderDialog(true, ['series-1']);

    const splitBtn = screen.getByRole('button', { name: /split/i });
    fireEvent.click(splitBtn);

    await waitFor(() => {
      expect(mockSplit).toHaveBeenCalledWith('study-1', expect.objectContaining({
        Series: ['series-1'],
        KeepSource: false,
      }));
    });
  });
});
