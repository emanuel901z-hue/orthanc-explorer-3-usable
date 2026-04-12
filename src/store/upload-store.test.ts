// src/store/upload-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUploadStore, __resetFileRegistryForTests } from './upload-store';
import { useJobStore } from './job-store';

// Mock the XHR-based upload function
vi.mock('@/lib/upload-xhr', () => ({
  uploadDicomWithProgress: vi.fn(),
}));

// Mock DICOM validation — test Files are too small to pass the magic-bytes check
vi.mock('@/lib/dicom-validation', () => ({
  hasDicomMagicBytes: vi.fn(() => Promise.resolve(true)),
  isKnownNonDicom: vi.fn(() => false),
}));

// Mock getConfig so tests don't require window.__OE3_CONFIG__
vi.mock('@/config/runtime', () => ({
  getConfig: vi.fn(() => ({ orthancUrl: '/orthanc-proxy' })),
}));

// Mock auditClient
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { uploadDicomWithProgress } from '@/lib/upload-xhr';
import { auditClient } from '@/lib/audit';

const mockUpload = vi.mocked(uploadDicomWithProgress);
const mockAuditEmit = vi.mocked(auditClient.emit);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ ID: 'x', Status: 'Success' });
  useJobStore.setState({ jobs: [] });
  __resetFileRegistryForTests();
});

describe('addFiles()', () => {
  it('calls uploadDicomWithProgress once per file', async () => {
    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm'), new File(['b'], 'b.dcm')]);

    await vi.waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
  });

  it('creates a job per file with type upload', async () => {
    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].label).toBe('a.dcm');
    });
  });

  it('marks the job complete when upload succeeds', async () => {
    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('complete');
      expect(jobs[0].progress).toBe(100);
    });
  });

  it('marks the job as error when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('network error'));

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('error');
    });
  });

  it('emits a success audit event when upload succeeds', async () => {
    const auditSpy = mockAuditEmit;

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'success' }),
      ),
    );
  });

  it('emits a failure audit event when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('network error'));
    const auditSpy = mockAuditEmit;

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'failure' }),
      ),
    );
  });

  it('uses jobId (not file.name) as audit resourceId to avoid PHI leakage', async () => {
    const auditSpy = mockAuditEmit;

    useUploadStore.getState().addFiles([new File(['a'], 'patient-smith-dob19800101.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: expect.stringMatching(/^upload-/),
        }),
      ),
    );
    // Confirm the PHI-bearing filename is NOT in resourceId
    const call = auditSpy.mock.calls[0][0];
    expect(call.resourceId).not.toContain('patient-smith');
  });
});

describe('retryUpload()', () => {
  it('re-calls uploadDicomWithProgress for the same file after a failure', async () => {
    mockUpload
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ID: 'x', Status: 'Success' });

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    // Wait for error
    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('error');
    });

    const jobId = useJobStore.getState().jobs.filter((j) => j.type === 'upload')[0].id;
    useUploadStore.getState().retryUpload(jobId);

    // Wait for success
    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('complete');
    });

    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('does nothing when jobId is unknown (file no longer in registry)', () => {
    useUploadStore.getState().retryUpload('nonexistent-id');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
