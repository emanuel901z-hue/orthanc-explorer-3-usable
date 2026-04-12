import { describe, it, expect } from 'vitest';
import { buildWadorsImageId } from './cornerstoneImageIds';

describe('buildWadorsImageId', () => {
  it('builds a wadors: URL with correct DICOMweb path segments', () => {
    const id = buildWadorsImageId({
      studyUID: '1.2.3',
      seriesUID: '1.2.3.4',
      instanceUID: '1.2.3.4.5',
    });
    expect(id).toBe(
      'wadors:/orthanc-proxy/dicom-web/studies/1.2.3/series/1.2.3.4/instances/1.2.3.4.5/frames/1'
    );
  });

  it('defaults frame to 1', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
    });
    expect(id).toContain('/frames/1');
  });

  it('accepts an explicit frame number', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
      frame: 3,
    });
    expect(id).toContain('/frames/3');
  });

  it('accepts a custom baseUrl', () => {
    const id = buildWadorsImageId({
      studyUID: 'A',
      seriesUID: 'B',
      instanceUID: 'C',
      baseUrl: 'https://pacs.example.com/wado-rs',
    });
    expect(id).toContain('wadors:https://pacs.example.com/wado-rs');
  });
});
