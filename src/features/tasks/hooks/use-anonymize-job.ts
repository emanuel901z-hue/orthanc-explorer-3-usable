import { useCallback } from 'react';
import { useJobStore } from '@/store/job-store';

interface AnonymizeTarget {
  level: 'study' | 'series' | 'instance';
  id: string;
  label: string;
}

interface AnonymizeOptions {
  newPatientName?: string;
  newPatientId?: string;
  keepStudyDescription: boolean;
  keepSeriesDescription: boolean;
}

export function useAnonymizeJob() {
  const startAnonymize = useCallback(({ level, id, label }: AnonymizeTarget, options: AnonymizeOptions) => {
    const jobStore = useJobStore.getState();
    const jobId = `anonymize-${Date.now()}`;

    const desc = [
      options.newPatientName && `→ ${options.newPatientName}`,
      options.keepStudyDescription && 'keep study desc',
      options.keepSeriesDescription && 'keep series desc',
    ].filter(Boolean).join(', ') || 'Full anonymization';

    jobStore.addJob({
      id: jobId,
      type: 'anonymize',
      label: `${label} (${level})`,
      description: desc,
      progress: 0,
      status: 'pending',
    });

    // Simulate anonymization progress
    setTimeout(() => {
      jobStore.updateJob(jobId, { status: 'running' });
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 25 + 10;
        if (p >= 100) {
          clearInterval(interval);
          const success = Math.random() > 0.1;
          jobStore.updateJob(jobId, {
            progress: 100,
            status: success ? 'complete' : 'error',
            error: success ? undefined : 'Anonymization failed — could not write modified tags',
          });
        } else {
          jobStore.updateJob(jobId, { progress: p });
        }
      }, 400 + Math.random() * 300);
    }, 200);
  }, []);

  return { startAnonymize };
}
