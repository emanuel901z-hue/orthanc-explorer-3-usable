import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MigrateSeriesDialog from './MigrateSeriesDialog';
import '@/i18n';

const { mockMigrateSeriesAction } = vi.hoisted(() => ({
  mockMigrateSeriesAction: vi.fn(),
}));

vi.mock('@/actions/migrateSeries', () => ({
  migrateSeriesAction: mockMigrateSeriesAction,
}));

const mockStudies = [
  {
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
  },
  {
    id: 'study-2',
    patientName: 'Target^Patient',
    patientId: 'P002',
    studyDate: new Date('2026-02-01'),
    studyDescription: 'CT Abdomen',
    accessionNumber: 'ACC456',
    studyInstanceUID: '1.2.3.4.6',
    modalities: ['CT'],
    numberOfSeries: 1,
    numberOfInstances: 10,
    isStable: true,
    labels: [],
    lastUpdate: new Date('2026-02-01'),
  },
];

vi.mock('@/features/studies/hooks/use-studies', () => ({
  useStudies: vi.fn(() => ({ data: mockStudies, isLoading: false })),
}));

const mockSeries1 = {
  id: 'series-1',
  studyId: 'study-1',
  seriesNumber: 1,
  seriesDescription: 'Scout',
  modality: 'CT',
  numberOfInstances: 2,
  seriesInstanceUID: '1.2.3.4.5.1',
  firstInstanceId: 'inst-1',
};

const mockSeries2 = {
  id: 'series-2',
  studyId: 'study-1',
  seriesNumber: 2,
  seriesDescription: 'Axial Reconstructions',
  modality: 'CT',
  numberOfInstances: 50,
  seriesInstanceUID: '1.2.3.4.5.2',
  firstInstanceId: 'inst-2',
};

function renderDialog(props: Partial<React.ComponentProps<typeof MigrateSeriesDialog>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MigrateSeriesDialog
        open={true}
        onOpenChange={() => {}}
        currentStudyId="study-1"
        series={mockSeries1}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('MigrateSeriesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders single series info and candidate studies', () => {
    renderDialog({ series: mockSeries1 });
    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText('(P002)')).toBeInTheDocument();
  });

  it('migrates single series when candidate is selected and button is clicked', async () => {
    mockMigrateSeriesAction.mockResolvedValue({
      TargetStudy: 'study-2',
      InstancesCount: 2,
      FailedInstancesCount: 0,
    });

    renderDialog({ series: mockSeries1 });

    const targetOption = screen.getByText('(P002)');
    fireEvent.click(targetOption);

    const migrateBtn = screen.getByRole('button', { name: /migr/i });
    fireEvent.click(migrateBtn);

    await waitFor(() => {
      expect(mockMigrateSeriesAction).toHaveBeenCalledWith('study-2', ['series-1'], false);
    });
  });

  it('renders multiple series in bulk mode and migrates all selected series', async () => {
    mockMigrateSeriesAction.mockResolvedValue({
      TargetStudy: 'study-2',
      InstancesCount: 52,
      FailedInstancesCount: 0,
    });

    const onSuccess = vi.fn();
    renderDialog({
      series: null,
      seriesList: [mockSeries1, mockSeries2],
      onSuccess,
    });

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    const targetOption = screen.getByText('(P002)');
    fireEvent.click(targetOption);

    const migrateBtn = screen.getByRole('button', { name: /migr/i });
    fireEvent.click(migrateBtn);

    await waitFor(() => {
      expect(mockMigrateSeriesAction).toHaveBeenCalledWith('study-2', ['series-1', 'series-2'], false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
