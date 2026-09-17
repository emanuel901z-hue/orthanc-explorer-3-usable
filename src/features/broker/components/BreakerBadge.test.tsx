import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakerBadge } from './BreakerBadge';
import '@/i18n';

describe('BreakerBadge', () => {
  it('renders nothing while the breaker is closed or unknown', () => {
    const { container: closed } = render(
      <BreakerBadge state="closed" onReset={vi.fn()} pending={false} />,
    );
    expect(closed).toBeEmptyDOMElement();

    const { container: unknown } = render(
      <BreakerBadge state={null} onReset={vi.fn()} pending={false} />,
    );
    expect(unknown).toBeEmptyDOMElement();
  });

  it('shows the cooldown for an open breaker', () => {
    render(<BreakerBadge state="open" retryInS={42} onReset={vi.fn()} pending={false} />);
    expect(screen.getByText(/breaker open/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('shows the probing state for a half-open breaker', () => {
    render(<BreakerBadge state="half_open" onReset={vi.fn()} pending={false} />);
    expect(screen.getByText(/half-open/i)).toBeInTheDocument();
  });

  it('triggers the reset and disables the button while pending', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <BreakerBadge state="open" retryInS={10} onReset={onReset} pending={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /reset circuit breaker/i }));
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(<BreakerBadge state="open" retryInS={10} onReset={onReset} pending />);
    expect(screen.getByRole('button', { name: /reset circuit breaker/i })).toBeDisabled();
  });
});
