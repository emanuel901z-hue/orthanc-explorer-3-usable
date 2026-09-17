import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HealthPanel } from './HealthPanel';
import type { BrokerHealth } from '@/api/broker';
import '@/i18n';

function health(overrides: Partial<BrokerHealth> = {}): BrokerHealth {
  return {
    findings: [],
    summary: { error: 0, warning: 0, info: 0 },
    ...overrides,
  };
}

describe('HealthPanel', () => {
  it('reports a clean configuration', () => {
    render(<HealthPanel health={health()} onNavigate={vi.fn()} />);
    expect(screen.getByText(/all checks passed/i)).toBeInTheDocument();
    expect(screen.getByText(/no findings/i)).toBeInTheDocument();
  });

  it('renders an error finding with a localized, actionable sentence', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'no_default_target', severity: 'error',
            message: 'English fallback', entity: {}, details: {},
          }],
          summary: { error: 1, warning: 0, info: 0 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/no enabled default target/i)).toBeInTheDocument();
    expect(screen.queryByText('English fallback')).not.toBeInTheDocument();
  });

  it('falls back to the API message for unknown codes', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'some_future_check', severity: 'info',
            message: 'Something new happened', entity: {}, details: {},
          }],
          summary: { error: 0, warning: 0, info: 1 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText('Something new happened')).toBeInTheDocument();
  });

  it('interpolates details and joins list values', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'multiple_default_targets', severity: 'error',
            message: 'fallback', entity: {}, details: { count: 2, names: ['a', 'b'] },
          }],
          summary: { error: 1, warning: 0, info: 0 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 targets are marked as default \(a, b\)/i)).toBeInTheDocument();
  });

  it('interpolates the entity name and id into the message', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'source_breaker_open', severity: 'warning',
            message: 'fallback', entity: { kind: 'source', id: 7, name: 'ris-down' },
            details: { retry_in_s: 30, failures: 3 },
          }],
          summary: { error: 0, warning: 1, info: 0 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    const text = screen.getByText(/temporarily skipped/i).textContent ?? '';
    expect(text).toContain('ris-down');
    expect(text).toContain('30');
    expect(text).not.toContain('{{');
  });

  it('interpolates the rule id', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'rule_source_disabled', severity: 'warning',
            message: 'fallback', entity: { kind: 'rule', id: 12 }, details: {},
          }],
          summary: { error: 0, warning: 1, info: 0 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Rule 12/)).toBeInTheDocument();
  });

  it('deep-links by entity kind', () => {
    const onNavigate = vi.fn();
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'source_breaker_open', severity: 'warning',
            message: 'fallback', entity: { kind: 'source', id: 7, name: 'ris-down' },
            details: { retry_in_s: 30, failures: 3 },
          }],
          summary: { error: 0, warning: 1, info: 0 },
        })}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('ris-down')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fix/i }));
    expect(onNavigate).toHaveBeenCalledWith('/broker/sources');
  });

  it('deep-links by code when the finding has no entity', () => {
    const onNavigate = vi.fn();
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'aet_whitelist_empty', severity: 'info',
            message: 'fallback', entity: {}, details: {},
          }],
          summary: { error: 0, warning: 0, info: 1 },
        })}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /fix/i }));
    expect(onNavigate).toHaveBeenCalledWith('/broker/settings');
  });

  it('shows the warning count when there are no errors', () => {
    render(
      <HealthPanel
        health={health({
          findings: [{
            code: 'no_working_source', severity: 'warning',
            message: 'fallback', entity: {}, details: {},
          }],
          summary: { error: 0, warning: 1, info: 0 },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
  });
});
