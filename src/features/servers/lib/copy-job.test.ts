import { describe, it, expect } from 'vitest';
import { describeCopyJob, isCopyConfirmed, isMoveJob } from './copy-job';
import type { OrthancJob } from '@/api/jobs';

function moveJob(overrides: Partial<OrthancJob> = {}): OrthancJob {
  return {
    ID: 'job-1',
    Type: 'DicomMoveScu',
    State: 'Success',
    Progress: 100,
    CreationTime: '20261106T114657.025637',
    CompletionTime: '20261106T114657.029587',
    EffectiveRuntime: 0.003,
    ErrorCode: 0,
    ErrorDescription: 'Success',
    Content: {
      RemoteAet: 'ARCHIVE',
      TargetAet: 'hst_burn2CD',
      Query: [{ '0020,000d': '1.2.3', '0010,0020': 'P-100' }],
      Details: [{ DimseErrorStatus: 0, ReceivedInstancesIds: [] }],
    },
    ...overrides,
  };
}

describe('isMoveJob', () => {
  it('erkennt C-MOVE-Jobs', () => {
    expect(isMoveJob(moveJob())).toBe(true);
    expect(isMoveJob(moveJob({ Type: 'DicomStore' }))).toBe(false);
  });
});

describe('describeCopyJob', () => {
  it('liest Quelle, Ziel, Studie und DIMSE-Status aus dem Job', () => {
    const view = describeCopyJob(moveJob());

    expect(view).toMatchObject({
      jobId: 'job-1',
      state: 'success',
      sourceAet: 'ARCHIVE',
      targetAet: 'hst_burn2CD',
      studyInstanceUid: '1.2.3',
      patientId: 'P-100',
      dimseStatus: '0x0000',
      durationSeconds: 0.003,
    });
  });

  it('versteht symbolische Tag-Namen genauso wie Hex-Tags', () => {
    const view = describeCopyJob(moveJob({
      Content: { Query: [{ StudyInstanceUID: '9.9', PatientID: 'P-9' }] },
    }));

    expect(view.studyInstanceUid).toBe('9.9');
    expect(view.patientId).toBe('P-9');
  });

  it('meldet einen laufenden Job als running', () => {
    const view = describeCopyJob(moveJob({ State: 'Running', Progress: 40 }));
    expect(view.state).toBe('running');
    expect(view.progress).toBe(40);
  });

  it('nimmt bei Fehlschlag den Klartext aus dem Job mit', () => {
    const view = describeCopyJob(moveJob({
      State: 'Failure',
      ErrorDescription: 'Error in the network protocol',
      Content: { TargetAet: 'X', Details: [{ DimseErrorStatus: 0xa801 }] },
    }));

    expect(view.state).toBe('failed');
    expect(view.dimseStatus).toBe('0xA801');
    expect(view.error).toBe('Error in the network protocol');
  });

  it('erfindet keinen Fehlertext, wenn Orthanc "Success" meldet', () => {
    const view = describeCopyJob(moveJob({ State: 'Failure', ErrorDescription: 'Success' }));
    expect(view.error).toBeUndefined();
  });
});

describe('isCopyConfirmed', () => {
  it('bestätigt nur mit DIMSE 0x0000', () => {
    expect(isCopyConfirmed(describeCopyJob(moveJob()))).toBe(true);
    expect(isCopyConfirmed(describeCopyJob(moveJob({
      Content: { Details: [{ DimseErrorStatus: 0xa700 }] },
    })))).toBe(false);
    expect(isCopyConfirmed(describeCopyJob(moveJob({ State: 'Running' })))).toBe(false);
  });
});

describe('describeCopyJob — Robustheit gegenüber kargen Jobs', () => {
  it('kommt ohne Content aus', () => {
    const view = describeCopyJob(moveJob({ Content: undefined }));
    expect(view.targetAet).toBeUndefined();
    expect(view.dimseStatus).toBeUndefined();
    expect(view.studyInstanceUid).toBeUndefined();
  });

  it('wertet einen angehaltenen Job als laufend', () => {
    expect(describeCopyJob(moveJob({ State: 'Paused', Progress: 60 })).state).toBe('running');
    expect(describeCopyJob(moveJob({ State: 'Retry', Progress: 0 })).state).toBe('running');
    expect(describeCopyJob(moveJob({ State: 'Pending', Progress: 0 })).state).toBe('running');
  });

  it('lässt Zeitstempel und Laufzeit weg, wenn Orthanc sie nicht liefert', () => {
    const view = describeCopyJob(moveJob({ CompletionTime: undefined, EffectiveRuntime: undefined }));
    expect(view.completionTime).toBeUndefined();
    expect(view.durationSeconds).toBeUndefined();
    expect(view.creationTime).toBe('20261106T114657.025637');
  });

  it('nimmt ErrorDetails, wenn ErrorDescription nichts sagt', () => {
    const view = describeCopyJob(moveJob({
      State: 'Failure',
      ErrorDescription: 'Success',
      ErrorDetails: 'Association rejected',
    }));
    expect(view.error).toBe('Association rejected');
  });

  it('ignoriert ein leeres Query-Array', () => {
    const view = describeCopyJob(moveJob({ Content: { Query: [], Details: [] } }));
    expect(view.studyInstanceUid).toBeUndefined();
    expect(view.dimseStatus).toBeUndefined();
  });
});

describe('describeCopyJob — Teilfehler sind kein Erfolg', () => {
  it('meldet einen Job mit DIMSE 0xB000 als Warnung', () => {
    const view = describeCopyJob(moveJob({ Content: { TargetAet: 'X', Details: [{ DimseErrorStatus: 0xb000 }] } }));
    expect(view.state).toBe('warning');
    expect(view.dimseStatus).toBe('0xB000');
    expect(view.dimseKey).toBe('partial');
  });

  it('meldet einen Job mit DIMSE 0x0000 als Erfolg', () => {
    const view = describeCopyJob(moveJob());
    expect(view.state).toBe('success');
    expect(view.dimseKey).toBe('success');
  });

  it('bleibt bei einem Fehlerstatus ein Fehlschlag', () => {
    const view = describeCopyJob(moveJob({ Content: { Details: [{ DimseErrorStatus: 0xa801 }] } }));
    expect(view.state).toBe('failed');
    expect(view.dimseKey).toBe('unknownDestination');
  });
});
