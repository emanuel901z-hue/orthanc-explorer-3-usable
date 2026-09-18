import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AboutDialog } from './AboutDialog';
import '@/i18n';

vi.mock('@/features/settings/hooks/use-system-info', () => ({
  useSystemInfo: () => ({ data: { Version: '1.12.4', ApiVersion: 22, DicomAet: 'ORTHANC', DatabaseVersion: 6 } }),
  useStats: () => ({ data: { CountStudies: 12, CountSeries: 30, CountInstances: 900 } }),
  usePlugins: () => ({ data: [] }),
}));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AboutDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe('AboutDialog', () => {
  it('describes the MWL broker, not only the base features', async () => {
    renderDialog();

    // the description mentions the broker …
    expect(await screen.findByText(/routes the stored images/i)).toBeInTheDocument();
    // … and there is a dedicated group with its capabilities
    expect(screen.getByText('MWL broker')).toBeInTheDocument();
    expect(screen.getByText('Worklist cache (outage bridge)')).toBeInTheDocument();
    expect(screen.getByText('C-STORE spool + retry')).toBeInTheDocument();
    expect(screen.getByText('DICOM TLS/mTLS')).toBeInTheDocument();
    expect(screen.getByText('ATNA audit export')).toBeInTheDocument();
  });

  it('still shows the system information and the fork feature list', () => {
    renderDialog();
    expect(screen.getByText('System Information')).toBeInTheDocument();
    expect(screen.getByText('Fork Features')).toBeInTheDocument();
    expect(screen.getByText('Study/Series merge')).toBeInTheDocument();
  });
});
