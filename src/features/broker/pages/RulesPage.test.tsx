import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RulesPage from './RulesPage';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockRules, mockSources, mockTargets, mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockRules: vi.fn(),
  mockSources: vi.fn(),
  mockTargets: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/api/broker', () => ({
  brokerApi: {
    status: vi.fn(() => Promise.resolve({
      scp_listening: true, db_ok: true, sources: [], targets: [],
      counts: { queries: 0, stores: 0, seen_items: 0 },
    })),
    sources: { list: mockSources, echo: vi.fn() },
    targets: { list: mockTargets, echo: vi.fn() },
    rules: { list: mockRules, create: mockCreate, update: mockUpdate, delete: mockDelete },
    transforms: { list: vi.fn(() => Promise.resolve([])) },
    settings: { list: vi.fn(() => Promise.resolve([])) },
    logs: { queries: vi.fn(() => Promise.resolve([])), stores: vi.fn(() => Promise.resolve([])) },
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RulesPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {},
    };
    loadConfig();
    mockRules.mockResolvedValue([
      { id: 1, source_id: 10, target_id: 20, priority: 10, enabled: true },
    ]);
    mockSources.mockResolvedValue([
      { id: 10, name: 'ris-a', aet: 'RIS_A', host: 'h', port: 1, calling_aet: 'C',
        charset: 'ISO_IR 100', enabled: true, timeout_s: 10, priority: 10, created_at: '' },
    ]);
    mockTargets.mockResolvedValue([
      { id: 20, name: 'pacs-kh', aet: 'PACS_KH', host: 'h', port: 1, calling_aet: 'C',
        enabled: true, is_default: true, created_at: '' },
    ]);
    mockCreate.mockResolvedValue({ id: 2 });
    mockUpdate.mockResolvedValue({ id: 1 });
    mockDelete.mockResolvedValue(undefined);
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('resolves source and target names', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());
    expect(screen.getByText('pacs-kh')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('toggles a rule through the switch (audited update)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toBe(1);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      source_id: 10, target_id: 20, enabled: false,
    });
  });

  // Radix Select cannot be opened reliably in jsdom (no layout/pointer events),
  // so the dialog's create path with a fresh selection is covered by the
  // Playwright suite against the real stack. Here we exercise the same submit
  // code path through the prefilled edit dialog.
  it('edits a rule through the prefilled dialog', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit rule/i }));
    const priority = screen.getByLabelText('Priority') as HTMLInputElement;
    expect(priority.value).toBe('10');
    fireEvent.change(priority, { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toBe(1);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      source_id: 10, target_id: 20, priority: 42,
    });
  });

  it('shows the server error when saving is rejected', async () => {
    mockUpdate.mockRejectedValue(new Error('source 10 not found'));
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit rule/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('source 10 not found');
  });

  it('deletes a rule after confirmation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('ris-a')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete rule/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });

  it('disables the add button when no sources/targets exist', async () => {
    mockRules.mockResolvedValue([]);
    mockSources.mockResolvedValue([]);
    mockTargets.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/no routing rules/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add rule/i })).toBeDisabled();
  });
});
