import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/runtime', () => ({
  getConfig: vi.fn().mockReturnValue({ authMode: 'none', orthancUrl: '/api/v1/pacs/orthanc' }),
}));

import { AuthProvider, useAuth } from './auth-context';
import { getConfig } from '@/config/runtime';

function DisplayAuth() {
  const { user, isAuthenticated, isLoading } = useAuth();
  return (
    <div data-testid="auth">
      {isLoading ? 'loading' : isAuthenticated ? user?.displayName : 'unauthenticated'}
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockReturnValue({
      authMode: 'none',
      orthancUrl: '/api/v1/pacs/orthanc',
    } as ReturnType<typeof getConfig>);
  });

  it('shows unauthenticated when /oe3-me returns 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Unauthorized"}', { status: 401 })
    );
    render(<AuthProvider><DisplayAuth /></AuthProvider>);
    await waitFor(() => {
      const el = screen.getByTestId('auth');
      expect(el.textContent).toBe('unauthenticated');
    });
  });

  it('provides user when /oe3-me returns 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        id: 'user-1',
        displayName: 'Dr. Test Admin',
        email: 'admin@test.org',
        initials: 'TA',
        roles: ['ADMIN'],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    render(<AuthProvider><DisplayAuth /></AuthProvider>);
    await waitFor(() => {
      const el = screen.getByTestId('auth');
      expect(el.textContent).toBe('Dr. Test Admin');
    });
  });

  it('throws when authMode is oidc (not yet implemented)', () => {
    vi.mocked(getConfig).mockReturnValue({ authMode: 'oidc', orthancUrl: '/api/v1/pacs/orthanc' } as ReturnType<typeof getConfig>);
    expect(() => render(<AuthProvider><div /></AuthProvider>)).toThrow(/OIDC auth not yet implemented/);
  });

  it('throws when authMode is smart (not yet implemented)', () => {
    vi.mocked(getConfig).mockReturnValue({ authMode: 'smart', orthancUrl: '/api/v1/pacs/orthanc' } as ReturnType<typeof getConfig>);
    expect(() => render(<AuthProvider><div /></AuthProvider>)).toThrow(/SMART-on-FHIR/);
  });
});
