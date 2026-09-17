import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrokerPageShell } from './BrokerPageShell';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

function setConfig(extra: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__OE3_CONFIG__ = { orthancUrl: '', authMode: 'none', features: {}, ...extra };
  loadConfig();
}

describe('BrokerPageShell', () => {
  afterEach(() => __resetConfigForTests());

  it('renders the not-configured hint when brokerUrl is missing', () => {
    setConfig({});
    render(
      <BrokerPageShell titleKey="broker.sourcesTitle" subtitleKey="broker.sourcesSubtitle">
        <p>should not render</p>
      </BrokerPageShell>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Upstream sources');
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    expect(screen.queryByText('should not render')).not.toBeInTheDocument();
  });

  it('renders title, subtitle, actions and children when configured', () => {
    setConfig({ brokerUrl: '/broker-api' });
    render(
      <BrokerPageShell
        titleKey="broker.targetsTitle"
        subtitleKey="broker.targetsSubtitle"
        actions={<button type="button">Add</button>}
      >
        <p>content</p>
      </BrokerPageShell>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Store targets');
    expect(screen.getByText('PACS destinations that receive forwarded C-STORE traffic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByText(/not configured/i)).not.toBeInTheDocument();
  });
});
