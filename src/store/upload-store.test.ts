// src/store/upload-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUploadStore, __resetFileRegistryForTests } from './upload-store';
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { useJobStore } from './job-store';

beforeEach(() => {
  vi.restoreAllMocks();
  useJobStore.setState({ jobs: [] });
  __resetFileRegistryForTests();
});

describe('addFiles()', () => {
  it('calls instancesApi.upload once per file', async () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm'), new File(['b'], 'b.dcm')]);

    await vi.waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(2));
  });

  it('creates a job per file with type upload', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].label).toBe('a.dcm');
    });
  });

  it('marks the job complete when upload succeeds', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('complete');
      expect(jobs[0].progress).toBe(100);
    });
  });

  it('marks the job as error when upload fails', async () => {
    vi.spyOn(instancesApi, 'upload').mockRejectedValue(new Error('network error'));
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('error');
    });
  });

  it('emits a success audit event when upload succeeds', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    const auditSpy = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'success' }),
      ),
    );
  });

  it('emits a failure audit event when upload fails', async () => {
    vi.spyOn(instancesApi, 'upload').mockRejectedValue(new Error('network error'));
    const auditSpy = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'failure' }),
      ),
    );
  });

  it('uses jobId (not file.name) as audit resourceId to avoid PHI leakage', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    const auditSpy = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

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
  it('re-calls instancesApi.upload for the same file after a failure', async () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

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

    expect(uploadSpy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when jobId is unknown (file no longer in registry)', () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    useUploadStore.getState().retryUpload('nonexistent-id');
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
