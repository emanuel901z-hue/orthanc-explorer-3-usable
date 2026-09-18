import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RbacBanner } from './RbacBanner';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockStatus } = vi.hoisted(() => ({ mockStatus: vi.fn() }));

vi.mock('@/api/broker', () => ({
  brokerApi: { rbac: { status: mockStatus } },
}));

function renderBanner(status: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RbacBanner />
    </QueryClientProvider>,
  );
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('RbacBanner', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('explains the read-only mode with the missing role', async () => {
    mockStatus.mockResolvedValue({
      mode: 'enforce', enforced: true, roles_header: 'X-OE3-Roles',
      write_role: 'brokerWrite', roles: ['brokerRead'], can_write: false,
    });
    renderWithProviders(<RbacBanner />);

    const banner = await screen.findByTestId('rbac-banner');
    expect(banner).toHaveTextContent(/needs the role/i);
    expect(banner).toHaveTextContent('brokerWrite');
  });

  it('stays hidden for a caller that may write', async () => {
    mockStatus.mockResolvedValue({
      mode: 'enforce', enforced: true, roles_header: 'X-OE3-Roles',
      write_role: 'brokerWrite', roles: ['brokerWrite'], can_write: true,
    });
    renderWithProviders(<RbacBanner />);

    await waitFor(() => expect(screen.queryByTestId('rbac-banner')).not.toBeInTheDocument());
  });

  it('shows nothing when enforcement is off', async () => {
    mockStatus.mockResolvedValue({
      mode: 'off', enforced: false, roles_header: 'X-OE3-Roles',
      write_role: 'brokerWrite', roles: [], can_write: true,
    });

    renderWithProviders(<RbacBanner />);

    expect(screen.queryByTestId('rbac-banner')).not.toBeInTheDocument();
  });
});
