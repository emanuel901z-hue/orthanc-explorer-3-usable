import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/runtime', () => ({
  getConfig: vi.fn().mockReturnValue({ authMode: 'none' }),
}));

import { AuthProvider, useAuth } from './auth-context';
import { getConfig } from '@/config/runtime';

function DisplayAuth() {
  const { user, isAuthenticated } = useAuth();
  return <div data-testid="auth">{isAuthenticated ? user?.displayName : 'unauthenticated'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockReturnValue({ authMode: 'none' } as ReturnType<typeof getConfig>);
  });

  it('provides demo user when authMode is none', () => {
    render(<AuthProvider><DisplayAuth /></AuthProvider>);
    const el = screen.getByTestId('auth');
    expect(el.textContent).toBeTruthy();
    expect(el.textContent).not.toBe('unauthenticated');
  });

  it('throws when authMode is oidc (not yet implemented)', () => {
    vi.mocked(getConfig).mockReturnValue({ authMode: 'oidc' } as ReturnType<typeof getConfig>);
    expect(() => render(<AuthProvider><div /></AuthProvider>)).toThrow(/OIDC auth not yet implemented/);
  });

  it('throws when authMode is smart (not yet implemented)', () => {
    vi.mocked(getConfig).mockReturnValue({ authMode: 'smart' } as ReturnType<typeof getConfig>);
    expect(() => render(<AuthProvider><div /></AuthProvider>)).toThrow(/SMART-on-FHIR/);
  });
});
