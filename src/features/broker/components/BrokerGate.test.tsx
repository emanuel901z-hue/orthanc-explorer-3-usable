/**
 * A deployment that only runs OE3 (plain Orthanc, no broker) must not offer a
 * console whose every request fails. The sidebar hides the section, but the
 * routes stayed reachable by URL — this gate closes that.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import { BrokerGate } from './BrokerGate';
import '@/i18n';

function renderGate(config: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', ...config };
  loadConfig();
  return render(
    <MemoryRouter><BrokerGate><p>Broker-Konsole</p></BrokerGate></MemoryRouter>,
  );
}

describe('BrokerGate', () => {
  afterEach(() => { __resetConfigForTests(); });

  it('shows the console when the deployment runs the broker', () => {
    renderGate({ brokerUrl: '/broker-api', features: { enableMwlBroker: true } });

    expect(screen.getByText('Broker-Konsole')).toBeInTheDocument();
    expect(screen.queryByTestId('broker-disabled')).toBeNull();
  });

  it('explains instead of failing when the broker is switched off', () => {
    renderGate({ brokerUrl: '/broker-api', features: { enableMwlBroker: false } });

    expect(screen.getByTestId('broker-disabled')).toBeInTheDocument();
    expect(screen.queryByText('Broker-Konsole')).toBeNull();
    // the operator is told what to set, not just "not configured"
    expect(screen.getByText(/brokerUrl/)).toBeInTheDocument();
  });

  it('explains when no broker URL is configured at all', () => {
    renderGate({ features: { enableMwlBroker: true } });

    expect(screen.getByTestId('broker-disabled')).toBeInTheDocument();
  });
});
