// PHI classification: UI (no PHI — persist-safe)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Job, JobType, JobStatus } from '@/shared/types/job';

interface JobState {
  jobs: Job[];
  addJob: (job: Omit<Job, 'createdAt' | 'updatedAt'>) => string;
  updateJob: (id: string, patch: Partial<Pick<Job, 'progress' | 'status' | 'error' | 'completedItems' | 'label' | 'description'>>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  retryJob: (id: string) => void;

  // Convenience helpers
  activeJobs: () => Job[];
  hasActiveJobs: () => boolean;
}

export const useJobStore = create<JobState>()(
  persist(
    (set, get) => ({
      jobs: [],

      addJob: (job) => {
        const now = Date.now();
        const fullJob: Job = { ...job, createdAt: now, updatedAt: now };
        set((s) => ({ jobs: [fullJob, ...s.jobs] }));
        return job.id;
      },

      updateJob: (id, patch) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j
          ),
        }));
      },

      removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

      clearCompleted: () =>
        set((s) => ({ jobs: s.jobs.filter((j) => j.status !== 'complete') })),

      retryJob: (id) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, status: 'pending' as JobStatus, progress: 0, error: undefined, updatedAt: Date.now() } : j
          ),
        }));
      },

      activeJobs: () => get().jobs.filter((j) => j.status === 'pending' || j.status === 'running'),
      hasActiveJobs: () => get().jobs.some((j) => j.status === 'pending' || j.status === 'running'),
    }),
    {
      name: 'orthanc-job-store',
      // Mark any 'running' jobs as 'interrupted' on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.jobs = state.jobs.map((j) =>
            j.status === 'running' || j.status === 'pending'
              ? { ...j, status: 'interrupted' as JobStatus }
              : j
          );
        }
      },
    }
  )
);
