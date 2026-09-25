import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ActivityDetailPanel } from './ActivityDetailPanel';
import type { ActivityEvent } from '@/shared/types/activity';
import '@/i18n';

/**
 * Regression: Orthanc job Content.Resources entries are `{ ID, Type }` objects
 * (TEMP-PACS modify/anonymize jobs). Rendering them directly threw React error
 * #31 ("Objects are not valid as a React child"). The panel must show the ID.
 */
function jobEvent(resources: unknown[], extraMetadata: Record<string, string> = {}): ActivityEvent {
  return {
    id: 'orthanc-job-efd1272c',
    timestamp: Date.now(),
    category: 'job',
    severity: 'success',
    title: 'Modify — Success',
    action: 'modify',
    metadata: {
      'Job ID': 'efd1272c-ddce-4ad5-9488-b949bfe588ad',
      State: 'Success',
      __rawContent: JSON.stringify({ Description: 'REST API', Resources: resources }, null, 2),
      ...extraMetadata,
    },
  };
}

function renderPanel(event: ActivityEvent) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ActivityDetailPanel event={event} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActivityDetailPanel — job resources', () => {
  it('renders { ID, Type } resource objects as their ID without crashing', () => {
    expect(() =>
      renderPanel(jobEvent([{ ID: '41f24091-b06f693d-0b741c9f', Type: 'Study' }])),
    ).not.toThrow();

    expect(screen.getByText('41f24091-b06f693d-0b741c9f')).toBeInTheDocument();
  });

  it('still renders the legacy plain-string form', () => {
    renderPanel(jobEvent(['instance-abc', { ID: 'study-xyz', Type: 'Study' }]));

    expect(screen.getByText('instance-abc')).toBeInTheDocument();
    expect(screen.getByText('study-xyz')).toBeInTheDocument();
  });

  it('caps the list at 20 entries and reports the remainder', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ID: `res-${i}`, Type: 'Instance' }));
    renderPanel(jobEvent(many));

    expect(screen.getByText('res-0')).toBeInTheDocument();
    expect(screen.getByText('res-19')).toBeInTheDocument();
    expect(screen.queryByText('res-20')).not.toBeInTheDocument();
    expect(screen.getByText('+5 more')).toBeInTheDocument();
  });

  it('skips malformed entries instead of rendering them', () => {
    renderPanel(jobEvent([{ Type: 'Series' }, null, 'valid-id']));

    expect(screen.getByText('valid-id')).toBeInTheDocument();
    expect(screen.queryByText(/object with keys/i)).not.toBeInTheDocument();
  });
});
