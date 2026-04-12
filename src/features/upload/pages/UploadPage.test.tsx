import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UploadPage from './UploadPage';

vi.mock('@/store/upload-store', () => ({
  useUploadStore: vi.fn(() => ({
    addFiles: vi.fn(),
    retryUpload: vi.fn(),
  })),
}));

vi.mock('@/store/job-store', () => ({
  useJobStore: vi.fn(() => ({
    jobs: [],
    addJob: vi.fn(),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('UploadPage — drop zone accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drop zone has role=button and tabIndex=0', () => {
    render(<UploadPage />);
    const dropZone = screen.getByTestId('upload-drop-zone');
    expect(dropZone).toHaveAttribute('role', 'button');
    expect(dropZone).toHaveAttribute('tabindex', '0');
  });

  it('pressing Enter on the drop zone triggers file picker', async () => {
    render(<UploadPage />);
    const dropZone = screen.getByTestId('upload-drop-zone');

    // Get the first file input and spy on its click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    fireEvent.keyDown(dropZone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('pressing Space on the drop zone triggers file picker', async () => {
    render(<UploadPage />);
    const dropZone = screen.getByTestId('upload-drop-zone');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    fireEvent.keyDown(dropZone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('drop zone has aria-label', () => {
    render(<UploadPage />);
    const dropZone = screen.getByTestId('upload-drop-zone');
    expect(dropZone).toHaveAttribute('aria-label', 'Drop DICOM files here or click to select');
  });
});
