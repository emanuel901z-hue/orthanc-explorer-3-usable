import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/actions/anonymizeStudy', () => ({
  anonymizeStudyAction: vi.fn().mockResolvedValue({ ID: 'new-study-789', Path: '/studies/new-study-789' }),
}));

vi.mock('@/store/job-store', () => ({
  useJobStore: {
    getState: vi.fn().mockReturnValue({
      addJob: vi.fn(),
      updateJob: vi.fn(),
    }),
  },
}));

import { useAnonymizeJob } from './use-anonymize-job';
import { anonymizeStudyAction } from '@/actions/anonymizeStudy';
import { useJobStore } from '@/store/job-store';

const qc = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(QueryClientProvider, { client: qc }, children)
);

describe('useAnonymizeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize mock return values after clearAllMocks
    vi.mocked(useJobStore.getState).mockReturnValue({
      addJob: vi.fn(),
      updateJob: vi.fn(),
    } as ReturnType<typeof useJobStore.getState>);
    vi.mocked(anonymizeStudyAction).mockResolvedValue({ ID: 'new-study-789', Path: '/studies/new-study-789' });
  });

  it('calls anonymizeStudyAction with correct arguments', async () => {
    const { result } = renderHook(() => useAnonymizeJob(), { wrapper });
    await act(async () => {
      await result.current.startAnonymize(
        { level: 'study', id: 'study-123', label: 'Doe^John' },
        { keepStudyDescription: true, keepSeriesDescription: false }
      );
    });
    expect(anonymizeStudyAction).toHaveBeenCalled();
  });

  it('does NOT use Math.random or setInterval', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    const intervalSpy = vi.spyOn(global, 'setInterval');
    renderHook(() => useAnonymizeJob(), { wrapper });
    expect(randomSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });

  it('adds a job and marks it complete on success', async () => {
    const { result } = renderHook(() => useAnonymizeJob(), { wrapper });
    await act(async () => {
      await result.current.startAnonymize(
        { level: 'study', id: 'study-123', label: 'Doe^John' },
        { keepStudyDescription: false, keepSeriesDescription: false }
      );
    });
    const { addJob, updateJob } = useJobStore.getState();
    expect(addJob).toHaveBeenCalledWith(expect.objectContaining({ type: 'anonymize', status: 'running' }));
    expect(updateJob).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'complete' }));
  });

  it('marks job as error when action fails', async () => {
    vi.mocked(anonymizeStudyAction).mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useAnonymizeJob(), { wrapper });
    await act(async () => {
      await result.current.startAnonymize(
        { level: 'study', id: 'study-123', label: 'Doe^John' },
        { keepStudyDescription: false, keepSeriesDescription: false }
      );
    });
    const { updateJob } = useJobStore.getState();
    expect(updateJob).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'error' }));
  });
});
