import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MoveInstancesToSeriesDialog } from './MoveInstancesToSeriesDialog';
import '@/i18n';

const { mockMove, mockGet } = vi.hoisted(() => ({
  mockMove: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('@/actions/moveInstancesToSeries', () => ({
  moveInstancesToSeriesAction: mockMove,
}));

vi.mock('@/api/instances', () => ({
  instancesApi: { get: mockGet },
}));

vi.mock('@/features/studies/hooks/use-studies', () => ({
  useStudySeries: () => ({
    data: [
      {
        id: 'series-current',
        seriesNumber: 1,
        seriesDescription: 'CurrentSrc',
        modality: 'CT',
        numberOfInstances: 3,
        seriesInstanceUID: '1.2.3.1',
      },
      {
        id: 'series-other',
        seriesNumber: 2,
        seriesDescription: 'OtherTarget',
        modality: 'CT',
        numberOfInstances: 5,
        seriesInstanceUID: '1.2.3.2',
      },
    ],
    isLoading: false,
  }),
}));

function renderDialog(
  props: Partial<React.ComponentProps<typeof MoveInstancesToSeriesDialog>> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MoveInstancesToSeriesDialog
          open={true}
          onOpenChange={() => {}}
          studyId="study-1"
          currentSeriesId="series-current"
          currentSeriesInstanceCount={3}
          currentSeriesNumber={1}
          currentSeriesDescription="SrcSeriesDesc"
          instanceIds={['inst-1', 'inst-2', 'inst-3']}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const successResult = {
  InstancesCount: 3,
  FailedInstancesCount: 0,
  Resources: [{ ID: 'new-1', Path: '/instances/new-1', Type: 'Instance' }],
  deletedCount: 3,
  deleteFailures: [],
};

describe('MoveInstancesToSeriesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ ID: 'new-1', ParentSeries: 'series-new' });
  });

  it('renders the selection count and lists only other series of the study', () => {
    renderDialog();
    expect(screen.getByText(/3\s+instances/i)).toBeInTheDocument();
    expect(screen.getByText(/OtherTarget/)).toBeInTheDocument();
    expect(screen.queryByText(/CurrentSrc/)).not.toBeInTheDocument();
  });

  it('moves the instances into the selected existing series (cut)', async () => {
    mockMove.mockResolvedValue(successResult);
    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    fireEvent.click(screen.getByText(/OtherTarget/));
    fireEvent.click(screen.getByRole('button', { name: /move \(3\)/i }));

    await waitFor(() => {
      expect(mockMove).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceIds: ['inst-1', 'inst-2', 'inst-3'],
          targetSeriesUid: '1.2.3.2',
          replace: expect.objectContaining({ SeriesNumber: '2', SeriesDescription: 'OtherTarget' }),
          keepSource: false,
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('creates a new series with a generated UID and custom description', async () => {
    mockMove.mockResolvedValue({ ...successResult, deletedCount: 3 });
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /new series/i }));
    fireEvent.change(screen.getByLabelText(/series description/i), {
      target: { value: 'Nodule Follow-up' },
    });
    fireEvent.click(screen.getByRole('button', { name: /move \(3\)/i }));

    await waitFor(() => {
      expect(mockMove).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSeriesUid: expect.stringMatching(/^2\.25\.\d+$/),
          replace: expect.objectContaining({ SeriesDescription: 'Nodule Follow-up' }),
        }),
      );
    });
  });

  it('passes keepSource true in copy mode', async () => {
    mockMove.mockResolvedValue(successResult);
    renderDialog();

    fireEvent.click(screen.getByText(/OtherTarget/));
    fireEvent.click(screen.getByRole('checkbox', { name: /keep source instances/i }));
    fireEvent.click(screen.getByRole('button', { name: /move \(3\)/i }));

    await waitFor(() => {
      expect(mockMove).toHaveBeenCalledWith(
        expect.objectContaining({ targetSeriesUid: '1.2.3.2', keepSource: true }),
      );
    });
  });

  it('keeps the submit button disabled until a target series is selected', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /move \(3\)/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/OtherTarget/));
    expect(screen.getByRole('button', { name: /move \(3\)/i })).not.toBeDisabled();
  });
});
