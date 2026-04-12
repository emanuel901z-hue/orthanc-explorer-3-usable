import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock XMLHttpRequest before importing the module under test
const mockXhrInstance = {
  open: vi.fn(),
  setRequestHeader: vi.fn(),
  send: vi.fn(),
  status: 200,
  responseText: '{"ID":"abc","Status":"Success"}',
  upload: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXhrInstance));

import { uploadDicomWithProgress } from './upload-xhr';

describe('uploadDicomWithProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXhrInstance.status = 200;
    mockXhrInstance.responseText = '{"ID":"abc","Status":"Success"}';
  });

  it('opens POST request to the given endpoint', async () => {
    // Simulate immediate load event
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'load') fn();
    });

    await uploadDicomWithProgress(
      new File(['DICM'], 'test.dcm'),
      '/orthanc-proxy/instances',
      () => {},
    );

    expect(mockXhrInstance.open).toHaveBeenCalledWith('POST', '/orthanc-proxy/instances');
    expect(mockXhrInstance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/dicom');
    expect(mockXhrInstance.send).toHaveBeenCalled();
  });

  it('resolves with parsed JSON on 200', async () => {
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'load') fn();
    });

    const result = await uploadDicomWithProgress(
      new File(['DICM'], 'test.dcm'),
      '/orthanc-proxy/instances',
      () => {},
    );

    expect(result).toEqual({ ID: 'abc', Status: 'Success' });
  });

  it('rejects with OrthancError on non-2xx status', async () => {
    mockXhrInstance.status = 413;
    mockXhrInstance.responseText = '';
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'load') fn();
    });

    await expect(
      uploadDicomWithProgress(new File(['DICM'], 'test.dcm'), '/orthanc-proxy/instances', () => {}),
    ).rejects.toThrow();
  });

  it('calls onProgress with percentage when progress event fires', async () => {
    const progressValues: number[] = [];

    mockXhrInstance.upload.addEventListener.mockImplementation(
      (event: string, fn: (e: { lengthComputable: boolean; loaded: number; total: number }) => void) => {
        if (event === 'progress') fn({ lengthComputable: true, loaded: 500, total: 1000 });
      },
    );
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'load') fn();
    });

    await uploadDicomWithProgress(
      new File(['DICM'], 'test.dcm'),
      '/orthanc-proxy/instances',
      (pct) => progressValues.push(pct),
    );

    expect(progressValues).toContain(50);
  });

  it('rejects with OrthancError on network error event', async () => {
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'error') fn();
    });

    await expect(
      uploadDicomWithProgress(new File(['DICM'], 'test.dcm'), '/orthanc-proxy/instances', () => {}),
    ).rejects.toThrow();
  });

  it('rejects with OrthancError on abort event', async () => {
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'abort') fn();
    });

    await expect(
      uploadDicomWithProgress(new File(['DICM'], 'test.dcm'), '/orthanc-proxy/instances', () => {}),
    ).rejects.toThrow();
  });

  it('rejects when response body is not valid JSON on 200', async () => {
    mockXhrInstance.responseText = 'not-json';
    mockXhrInstance.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === 'load') fn();
    });

    await expect(
      uploadDicomWithProgress(new File(['DICM'], 'test.dcm'), '/orthanc-proxy/instances', () => {}),
    ).rejects.toThrow();
  });
});
