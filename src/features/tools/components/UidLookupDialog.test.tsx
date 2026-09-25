import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UidLookupDialog } from './UidLookupDialog';
import { toolsApi } from '@/api/tools';
import '@/i18n';

vi.mock('@/api/tools', () => ({
  toolsApi: {
    lookup: vi.fn(),
  },
}));

describe('UidLookupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches for UIDs and displays matching resources', async () => {
    vi.mocked(toolsApi.lookup).mockResolvedValue([
      { ID: 'study-123', Path: '/studies/study-123', Type: 'Study' },
    ]);

    render(
      <MemoryRouter>
        <UidLookupDialog open={true} onOpenChange={() => {}} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText(/1\.2\.840|Orthanc UUID/i);
    fireEvent.change(input, { target: { value: '1.2.840.10008.1.2.3' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('study-123')).toBeInTheDocument();
      expect(screen.getByText('Study')).toBeInTheDocument();
    });
    expect(toolsApi.lookup).toHaveBeenCalledWith('1.2.840.10008.1.2.3');
  });

  it('shows empty message when no resources match', async () => {
    vi.mocked(toolsApi.lookup).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <UidLookupDialog open={true} onOpenChange={() => {}} />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText(/1\.2\.840|Orthanc UUID/i);
    fireEvent.change(input, { target: { value: 'unknown.uid' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/No DICOM resource matches/i)).toBeInTheDocument();
    });
  });
});
