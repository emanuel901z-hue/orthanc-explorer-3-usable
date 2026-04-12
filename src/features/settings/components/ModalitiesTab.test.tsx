import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalitiesTab from './ModalitiesTab';

const mutateMock = vi.fn();

vi.mock('@/features/settings/hooks/useModalities', () => ({
  useModalities: vi.fn(() => ({ data: ['PACS1', 'PACS2'] })),
}));

vi.mock('@/features/settings/hooks/useModalityConfig', () => ({
  useModalityConfig: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/features/settings/hooks/useEchoModality', () => ({
  useEchoModality: vi.fn(() => ({ mutate: mutateMock })),
}));

vi.mock('@/features/settings/hooks/useDeleteModality', () => ({
  useDeleteModality: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('ModalitiesTab — Echo All', () => {
  beforeEach(() => {
    mutateMock.mockClear();
  });

  it('calls echo.mutate for each modality (not echoModalityAction directly)', () => {
    render(<ModalitiesTab onAddClick={vi.fn()} onEditClick={vi.fn()} />);
    fireEvent.click(screen.getByText(/echo all/i));

    expect(mutateMock).toHaveBeenCalledWith('PACS1', expect.any(Object));
    expect(mutateMock).toHaveBeenCalledWith('PACS2', expect.any(Object));
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });
});
