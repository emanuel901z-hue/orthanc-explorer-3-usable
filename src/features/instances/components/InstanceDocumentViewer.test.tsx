import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  InstanceDocumentViewer,
  isEncapsulatedPdf,
  isStructuredReport,
  SOP_CLASS_ENCAPSULATED_PDF,
} from './InstanceDocumentViewer';
import { instancesApi } from '@/api/instances';
import '@/i18n';

vi.mock('@/api/instances', () => ({
  instancesApi: {
    getPdf: vi.fn(),
  },
}));

describe('InstanceDocumentViewer helpers', () => {
  it('identifies encapsulated PDF SOP Class UID', () => {
    expect(isEncapsulatedPdf(SOP_CLASS_ENCAPSULATED_PDF)).toBe(true);
    expect(isEncapsulatedPdf('1.2.840.10008.5.1.4.1.1.2')).toBe(false);
  });

  it('identifies structured report SOP Class UIDs', () => {
    expect(isStructuredReport('1.2.840.10008.5.1.4.1.1.88.11')).toBe(true);
    expect(isStructuredReport('1.2.840.10008.5.1.4.1.1.88.33')).toBe(true);
    expect(isStructuredReport('1.2.840.10008.5.1.4.1.1.2')).toBe(false);
  });
});

describe('InstanceDocumentViewer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-pdf');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders embedded PDF iframe when instance is Encapsulated PDF', async () => {
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(instancesApi.getPdf).mockResolvedValue(mockBlob);

    render(
      <InstanceDocumentViewer
        instanceId="inst-pdf-1"
        sopClassUID={SOP_CLASS_ENCAPSULATED_PDF}
        tags={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTitle('Encapsulated PDF Document')).toBeInTheDocument();
    });
    expect(instancesApi.getPdf).toHaveBeenCalledWith('inst-pdf-1');
  });

  it('renders structured report findings when instance is Structured Report', () => {
    render(
      <InstanceDocumentViewer
        instanceId="inst-sr-1"
        sopClassUID="1.2.840.10008.5.1.4.1.1.88.33"
        tags={[
          { tag: '0040,a043', vr: 'SQ', name: 'DocumentTitle', value: 'CT Lung Screening Report' },
          { tag: '0040,a491', vr: 'CS', name: 'CompletionFlag', value: 'COMPLETE' },
          { tag: '0040,a493', vr: 'CS', name: 'VerificationFlag', value: 'VERIFIED' },
          { tag: '0040,a160', vr: 'UT', name: 'TextValue', value: 'No suspicious pulmonary nodules detected.' },
        ]}
      />,
    );

    expect(screen.getByText('CT Lung Screening Report')).toBeInTheDocument();
    expect(screen.getByText('COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('No suspicious pulmonary nodules detected.')).toBeInTheDocument();
  });
});
