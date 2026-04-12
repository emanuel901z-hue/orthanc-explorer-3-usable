import { create } from 'zustand';
import { useJobStore } from './job-store';

interface UploadState {
  addFiles: (files: File[]) => void;
}

export const useUploadStore = create<UploadState>(() => ({
  addFiles: (files) => {
    const jobStore = useJobStore.getState();

    files.forEach((f, i) => {
      const jobId = `upload-${Date.now()}-${i}`;
      jobStore.addJob({
        id: jobId,
        type: 'upload',
        label: f.name,
        description: formatSize(f.size),
        progress: 0,
        status: 'pending',
        totalItems: f.size,
        completedItems: 0,
      });

      // Simulate upload with delay
      setTimeout(() => {
        jobStore.updateJob(jobId, { status: 'running' });
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 15 + 5;
          if (progress >= 100) {
            clearInterval(interval);
            const success = Math.random() > 0.1;
            jobStore.updateJob(jobId, {
              progress: 100,
              status: success ? 'complete' : 'error',
              error: success ? undefined : 'Upload failed — connection timeout',
            });
          } else {
            jobStore.updateJob(jobId, { progress });
          }
        }, 300 + Math.random() * 200);
      }, 200 * (Math.random() + 0.5));
    });
  },
}));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
