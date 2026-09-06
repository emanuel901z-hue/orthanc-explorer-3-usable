import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalitiesTab from './ModalitiesTab';

const mutateMock = vi.fn();

vi.mock('@/features/settings/hooks/use-modalities', () => ({
  useModalities: vi.fn(() => ({ data: ['PACS1', 'PACS2'] })),
}));

vi.mock('@/features/settings/hooks/use-modality-config', () => ({
  useModalityConfig: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/features/settings/hooks/use-echo-modality', () => ({
  useEchoModality: vi.fn(() => ({ mutate: mutateMock })),
}));

vi.mock('@/features/settings/hooks/use-delete-modality', () => ({
  useDeleteModality: vi.fn(() => ({ mutate: vi.fn() })),
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

describe('ModalitiesTab — Echo All', () => {
  beforeEach(() => {
    mutateMock.mockClear();
  });

  it('calls echo.mutate for each modality (not echoModalityAction directly)', () => {
    render(<ModalitiesTab onAddClick={vi.fn()} onEditClick={vi.fn()} />);
    // i18n keys returned as-is in test env (react-i18next mocked): t('modality.echoAll')
    fireEvent.click(screen.getByText(/modality\.echoAll/i));

    expect(mutateMock).toHaveBeenCalledWith('PACS1', expect.any(Object));
    expect(mutateMock).toHaveBeenCalledWith('PACS2', expect.any(Object));
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('icon-only buttons have accessible aria-labels for each modality', () => {
    render(<ModalitiesTab onAddClick={vi.fn()} onEditClick={vi.fn()} />);

    // Buttons for PACS1
    expect(screen.getByRole('button', { name: /send c-echo to pacs1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit modality pacs1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete modality pacs1/i })).toBeInTheDocument();

    // Buttons for PACS2
    expect(screen.getByRole('button', { name: /send c-echo to pacs2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit modality pacs2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete modality pacs2/i })).toBeInTheDocument();
  });
});
