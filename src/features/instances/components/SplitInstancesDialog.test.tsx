import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SplitInstancesDialog } from './SplitInstancesDialog';
import '@/i18n';

const { mockSplit } = vi.hoisted(() => ({ mockSplit: vi.fn() }));

vi.mock('@/actions/splitStudy', () => ({
  splitStudyAction: mockSplit,
}));

function renderDialog(props: Partial<React.ComponentProps<typeof SplitInstancesDialog>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SplitInstancesDialog
          open={true}
          onOpenChange={() => {}}
          studyId="study-1"
          seriesDescription="Chest CT"
          seriesNumber={3}
          instanceIds={['inst-1', 'inst-2', 'inst-3']}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SplitInstancesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instance count and series description', () => {
    renderDialog();
    expect(screen.getByText(/3\s+instances/i)).toBeInTheDocument();
    expect(screen.getByText(/Chest CT/)).toBeInTheDocument();
  });

  it('splits instances into a new study with custom description', async () => {
    mockSplit.mockResolvedValue({
      TargetStudy: 'new-study-123',
      TargetStudyUID: '1.2.3.999',
      InstancesCount: 3,
    });

    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    const input = screen.getByLabelText(/new study description/i);
    fireEvent.change(input, { target: { value: 'Split Nodules Study' } });

    const splitBtn = screen.getByRole('button', { name: /split/i });
    fireEvent.click(splitBtn);

    await waitFor(() => {
      expect(mockSplit).toHaveBeenCalledWith('study-1', {
        Instances: ['inst-1', 'inst-2', 'inst-3'],
        KeepSource: false,
        Replace: {
          StudyDescription: 'Split Nodules Study',
        },
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('passes KeepSource true when checkbox is checked', async () => {
    mockSplit.mockResolvedValue({
      TargetStudy: 'new-study-123',
      TargetStudyUID: '1.2.3.999',
      InstancesCount: 3,
    });

    renderDialog();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const splitBtn = screen.getByRole('button', { name: /split/i });
    fireEvent.click(splitBtn);

    await waitFor(() => {
      expect(mockSplit).toHaveBeenCalledWith('study-1', expect.objectContaining({
        Instances: ['inst-1', 'inst-2', 'inst-3'],
        KeepSource: true,
      }));
    });
  });
});
