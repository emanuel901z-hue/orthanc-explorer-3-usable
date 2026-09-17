import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AuditPage from './AuditPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { auditQueryParams } from '../lib/config-diff';
import '@/i18n';

const {
  mockAudit, mockRollback, mockExport, mockImport,
} = vi.hoisted(() => ({
  mockAudit: vi.fn(),
  mockRollback: vi.fn(),
  mockExport: vi.fn(),
  mockImport: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    audit: { config: mockAudit, rollback: mockRollback },
    config: { export: mockExport, import: mockImport },
  },
}));

const ENTRY = {
  id: 7, ts: '2026-09-17T10:00:00Z', actor: 'dr.mueller', action: 'update.source',
  entity: 'source' as const, entity_id: 1,
  before_json: { name: 'ris-a', port: 11114 }, after_json: { name: 'ris-a', port: 11199 },
  correlation_id: '',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AuditPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockAudit.mockResolvedValue([ENTRY]);
    mockRollback.mockResolvedValue({ audit_id: 7, entity: 'source', action: 'restore', message: 'ok' });
    mockExport.mockResolvedValue({ schema_version: 1, sources: [], targets: [], rules: [], transforms: [], settings: {} });
    mockImport.mockResolvedValue({
      schema_version: 1, dry_run: true,
      changes: [{ entity: 'source', action: 'create', name: 'ris-b', fields: { aet: 'RIS_B' } }],
      skipped: ['rule ris-a → nope: unknown source or target'],
      summary: { create: 1, update: 0, skipped: 1 },
    });
    // jsdom has no object URLs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = vi.fn(() => 'blob:test');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = vi.fn();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('lists the recorded changes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());
    expect(screen.getByText('dr.mueller')).toBeInTheDocument();
    expect(screen.getByText('ris-a')).toBeInTheDocument();
    expect(screen.getByText(/1 field/i)).toBeInTheDocument();
  });

  // The entity filter is a Radix Select, which cannot be driven reliably in
  // jsdom — the interaction is covered by the Playwright stack suite. Here we
  // assert the initial query and the parameter mapping.
  it('queries all entities by default and maps the filter to query params', async () => {
    renderPage();
    await waitFor(() => expect(mockAudit).toHaveBeenCalledWith({}));
    expect(screen.getByLabelText(/filter by object type/i)).toBeInTheDocument();
    expect(auditQueryParams('all')).toEqual({ limit: 50 });
    expect(auditQueryParams('setting')).toEqual({ entity: 'setting', limit: 50 });
  });

  it('shows the before/after diff of a change', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /show changes/i }));

    expect(await screen.findByText('port')).toBeInTheDocument();
    expect(screen.getByText('11114')).toBeInTheDocument();
    expect(screen.getByText('11199')).toBeInTheDocument();
  });

  it('rolls a change back only after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /roll this change back/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/state before this change is restored/i)).toBeInTheDocument();
    expect(mockRollback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockRollback).toHaveBeenCalledWith(7));
  });

  it('exports the configuration as a file', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => expect(mockExport).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('imports through a dry-run diff and applies on confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());

    const file = new File([
      JSON.stringify({ schema_version: 1, sources: [], targets: [], rules: [], transforms: [], settings: {} }),
    ], 'config.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('audit-import-input'), { target: { files: [file] } });

    // dry-run first: the diff is shown, nothing applied yet
    await waitFor(() => expect(mockImport).toHaveBeenCalledWith(
      expect.anything(), true,
    ));
    expect(await screen.findByText('ris-b')).toBeInTheDocument();
    expect(screen.getByText(/unknown source or target/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /apply import/i }));

    await waitFor(() => expect(mockImport).toHaveBeenCalledWith(expect.anything(), false));
  });

  it('reports an unreadable import file', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('update.source')).toBeInTheDocument());

    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('audit-import-input'), { target: { files: [file] } });

    expect(await screen.findByTestId('import-error')).toBeInTheDocument();
  });
});
