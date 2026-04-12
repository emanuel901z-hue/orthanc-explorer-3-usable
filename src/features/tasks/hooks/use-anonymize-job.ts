import { useCallback } from 'react';
import { type Study } from '@/api/studies';
import { anonymizeStudyAction } from '@/actions/anonymizeStudy';
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
  const startAnonymize = useCallback(
    async ({ level, id, label }: AnonymizeTarget, options: AnonymizeOptions) => {
      const { addJob, updateJob } = useJobStore.getState();
      const jobId = `anonymize-${Date.now()}`;

      const desc = [
        options.newPatientName && `→ ${options.newPatientName}`,
        options.keepStudyDescription && 'keep study desc',
        options.keepSeriesDescription && 'keep series desc',
      ]
        .filter(Boolean)
        .join(', ') || 'Full anonymization';

      addJob({
        id: jobId,
        type: 'anonymize',
        label: `${label} (${level})`,
        description: desc,
        progress: 0,
        status: 'running',
      });

      const replace: Record<string, string> = {
        ...(options.newPatientName ? { PatientName: options.newPatientName } : {}),
        ...(options.newPatientId ? { PatientID: options.newPatientId } : {}),
      };
      const body: Record<string, unknown> = {
        Keep: [
          ...(options.keepStudyDescription ? ['StudyDescription'] : []),
          ...(options.keepSeriesDescription ? ['SeriesDescription'] : []),
        ],
        ...(Object.keys(replace).length > 0 ? { Replace: replace } : {}),
      };

      try {
        // anonymizeStudyAction only accesses study.ID internally; full Study shape is not required at runtime
        const stub = { ID: id } as Study;
        await anonymizeStudyAction(stub, body);
        updateJob(jobId, { progress: 100, status: 'complete' });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Anonymization failed';
        updateJob(jobId, { status: 'error', error: message });
      }
    },
    []
  );

  return { startAnonymize };
}
