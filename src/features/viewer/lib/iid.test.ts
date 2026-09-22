import { describe, it, expect } from 'vitest';
import {
  buildIidUrl,
  buildViewerUrl,
  limitToMostRecent,
  parseIidRequest,
  splitIidList,
} from './iid';

describe('parseIidRequest', () => {
  it('accepts a study request by study UID', () => {
    const r = parseIidRequest('?requestType=STUDY&studyUID=1.2.3,1.2.4');
    expect(r.error).toBe('');
    expect(r.requestType).toBe('STUDY');
    expect(r.studyUIDs).toEqual(['1.2.3', '1.2.4']);
    expect(r.accessionNumbers).toEqual([]);
  });

  it('accepts a study request by accession number', () => {
    const r = parseIidRequest('?requestType=STUDY&accessionNumber=ACC-1');
    expect(r.error).toBe('');
    expect(r.accessionNumbers).toEqual(['ACC-1']);
    expect(r.studyUIDs).toEqual([]);
  });

  it('accepts a patient request with the optional hints', () => {
    const r = parseIidRequest(
      '?requestType=PATIENT&patientID=99998410^^^Acme&mostRecentResults=1&viewerType=IHE_BIR&diagnosticQuality=true',
    );
    expect(r.error).toBe('');
    expect(r.requestType).toBe('PATIENT');
    expect(r.patientID).toBe('99998410^^^Acme');
    expect(r.mostRecentResults).toBe(1);
    expect(r.viewerType).toBe('IHE_BIR');
    expect(r.diagnosticQuality).toBe(true);
  });

  it('is case-insensitive about requestType', () => {
    expect(parseIidRequest('?requestType=study&studyUID=1.2.3').requestType).toBe('STUDY');
  });

  it('rejects a request without requestType', () => {
    expect(parseIidRequest('?studyUID=1.2.3').error).toBe('missingRequestType');
  });

  it('rejects an unknown requestType', () => {
    expect(parseIidRequest('?requestType=SERIES&studyUID=1.2.3').error)
      .toBe('unknownRequestType');
  });

  it('rejects a study request without a key', () => {
    expect(parseIidRequest('?requestType=STUDY').error).toBe('missingStudyKey');
  });

  it('rejects a study request that carries both keys', () => {
    // the supplement says "shall not be present otherwise" — guessing which one
    // the caller meant would be worse than saying no
    expect(parseIidRequest('?requestType=STUDY&studyUID=1.2.3&accessionNumber=ACC-1').error)
      .toBe('bothStudyKeys');
  });

  it('rejects a patient request without a patient ID', () => {
    expect(parseIidRequest('?requestType=PATIENT').error).toBe('missingPatientID');
  });

  it('rejects a nonsense mostRecentResults', () => {
    expect(parseIidRequest('?requestType=PATIENT&patientID=P1&mostRecentResults=abc').error)
      .toBe('badMostRecentResults');
    expect(parseIidRequest('?requestType=PATIENT&patientID=P1&mostRecentResults=-2').error)
      .toBe('badMostRecentResults');
  });

  it('ignores empty list entries instead of treating them as a key', () => {
    expect(parseIidRequest('?requestType=STUDY&studyUID=,, ').error).toBe('missingStudyKey');
  });
});

describe('splitIidList', () => {
  it('splits, trims and drops empties', () => {
    expect(splitIidList(' a , b ,, c ')).toEqual(['a', 'b', 'c']);
    expect(splitIidList(null)).toEqual([]);
  });
});

describe('buildIidUrl', () => {
  it('builds the study form with the UID list', () => {
    expect(buildIidUrl('/oe3/IHEInvokeImageDisplay', {
      requestType: 'STUDY', studyUIDs: ['1.2.3', '1.2.4'],
    })).toBe('/oe3/IHEInvokeImageDisplay?requestType=STUDY&studyUID=1.2.3%2C1.2.4');
  });

  it('prefers the study UID over an accession number', () => {
    const url = buildIidUrl('/x', {
      requestType: 'STUDY', studyUIDs: ['1.2.3'], accessionNumbers: ['ACC-1'],
    });
    expect(url).toContain('studyUID=1.2.3');
    expect(url).not.toContain('accessionNumber');
  });

  it('builds the accession form when that is all we have', () => {
    expect(buildIidUrl('/x', { requestType: 'STUDY', accessionNumbers: ['ACC-1'] }))
      .toBe('/x?requestType=STUDY&accessionNumber=ACC-1');
  });

  it('builds the patient form with the result limit', () => {
    expect(buildIidUrl('/x', {
      requestType: 'PATIENT', patientID: 'P1', mostRecentResults: 1,
    })).toBe('/x?requestType=PATIENT&patientID=P1&mostRecentResults=1');
  });

  it('passes the optional hints through', () => {
    const url = buildIidUrl('/x', {
      requestType: 'STUDY', studyUIDs: ['1.2.3'], viewerType: 'IHE_BIR', diagnosticQuality: true,
    });
    expect(url).toContain('viewerType=IHE_BIR');
    expect(url).toContain('diagnosticQuality=true');
  });
});

describe('buildViewerUrl', () => {
  it('appends the parameter to a bare URL', () => {
    expect(buildViewerUrl('/ohif/viewer', ['1.2.3', '1.2.4']))
      .toBe('/ohif/viewer?StudyInstanceUIDs=1.2.3,1.2.4');
  });

  it('extends a URL that already has a query', () => {
    expect(buildViewerUrl('/ohif/viewer?foo=1', ['1.2.3']))
      .toBe('/ohif/viewer?foo=1&StudyInstanceUIDs=1.2.3');
  });
});

describe('limitToMostRecent', () => {
  const studies = ['newest', 'middle', 'oldest'];

  it('keeps everything when no limit was asked for', () => {
    expect(limitToMostRecent(studies, null)).toEqual(studies);
    expect(limitToMostRecent(studies, 0)).toEqual(studies);
  });

  it('keeps only the newest N', () => {
    expect(limitToMostRecent(studies, 1)).toEqual(['newest']);
    expect(limitToMostRecent(studies, 2)).toEqual(['newest', 'middle']);
  });

  it('does not invent studies when the limit is larger than the list', () => {
    expect(limitToMostRecent(studies, 10)).toEqual(studies);
  });
});
