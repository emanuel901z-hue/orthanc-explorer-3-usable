// PHI classification: SESSION (may hold PHI — memory-only)
// File names passed to addFiles() may contain patient-identifying information.
import { create } from 'zustand';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { hasDicomMagicBytes, isKnownNonDicom } from '@/lib/dicom-validation';
import { uploadDicomWithProgress } from '@/lib/upload-xhr';
import { getConfig } from '@/config/runtime';
import { useJobStore } from './job-store';

// Module-level registry: File objects cannot be JSON-serialized,
// so we keep them outside Zustand persist scope.
const fileRegistry = new Map<string, File>();

/** Exposed for tests only — clears the file registry between test runs. */
export function __resetFileRegistryForTests(): void {
  fileRegistry.clear();
}

async function runUpload(jobId: string, file: File): Promise<void> {
  const jobStore = useJobStore.getState();

  // Validate DICOM magic bytes (DICM at offset 128) before uploading.
  const valid = await hasDicomMagicBytes(file);
  if (!valid) {
    fileRegistry.delete(jobId);
    jobStore.updateJob(jobId, {
      status: 'error',
      error: 'Not a valid DICOM file (missing DICM preamble)',
    });
    return;
  }

  jobStore.updateJob(jobId, { status: 'running', progress: 0 });

  const base = {
    action: 'instance.upload',
    resourceType: 'instance' as const,
    resourceId: jobId,
    timestamp: new Date().toISOString(),
  };

  try {
    const orthancBase = getConfig().orthancUrl?.replace(/\/$/, '') ?? '';
    await uploadDicomWithProgress(file, `${orthancBase}/instances`, (pct) => {
      jobStore.updateJob(jobId, { progress: pct });
    });
    auditClient.emit({ ...base, outcome: 'success' });
    fileRegistry.delete(jobId);
    jobStore.updateJob(jobId, { status: 'complete', progress: 100, completedItems: 1 });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    jobStore.updateJob(jobId, {
      status: 'error',
      error: e instanceof OrthancError ? e.message : 'Upload failed',
    });
    // Keep file in registry so retryUpload() can re-use it.
  }
}

interface UploadState {
  addFiles: (files: File[]) => void;
  retryUpload: (id: string) => void;
}

export const useUploadStore = create<UploadState>(() => ({
  addFiles: (files) => {
    const jobStore = useJobStore.getState();
    // Silently drop files that are definitely not DICOM by name pattern
    // (.DS_Store, .localized, Thumbs.db, known non-DICOM extensions, etc.).
    // Files with no extension pass through — many DICOM files from scanners
    // have no extension and are validated by magic bytes in runUpload().
    const candidates = files.filter((f) => !isKnownNonDicom(f));
    candidates.forEach((file) => {
      const jobId = `upload-${crypto.randomUUID()}`;
      fileRegistry.set(jobId, file);
      jobStore.addJob({
        id: jobId,
        type: 'upload',
        label: file.name,
        description: formatSize(file.size),
        progress: 0,
        status: 'pending',
        totalItems: 1,
        completedItems: 0,
      });
      void runUpload(jobId, file);
    });
  },

  retryUpload: (id) => {
    const file = fileRegistry.get(id);
    if (!file) return;
    const jobStore = useJobStore.getState();
    const job = jobStore.jobs.find((j) => j.id === id);
    if (!job || job.status === 'running' || job.status === 'pending') return;
    jobStore.updateJob(id, { status: 'pending', progress: 0, error: undefined });
    void runUpload(id, file);
  },
}));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
