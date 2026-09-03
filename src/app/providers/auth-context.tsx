/**
 * Authentication context.
 * In production (authMode "none" with backend proxy), fetches the current user
 * from /api/v1/pacs/oe3-me on boot. If 401/403, the SPA shows an auth-required screen.
 */

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { getConfig } from '@/config/runtime';

export type UserRole = 'admin' | 'physician' | 'technologist' | 'viewer';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  initials: string;
  roles: UserRole[];
}

export type Permission =
  | 'study:read'
  | 'study:write'
  | 'study:delete'
  | 'study:export'
  | 'study:send'
  | 'study:anonymize'
  | 'study:modify'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'study:read', 'study:write', 'study:delete', 'study:export',
    'study:send', 'study:anonymize', 'study:modify',
    'settings:read', 'settings:write', 'audit:read',
  ],
  physician: [
    'study:read', 'study:export', 'study:send', 'audit:read',
  ],
  technologist: [
    'study:read', 'study:write', 'study:export', 'study:send',
    'study:anonymize', 'study:modify',
  ],
  viewer: [
    'study:read',
  ],
};

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  permissions: Set<Permission>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function resolvePermissions(roles: UserRole[]): Set<Permission> {
  const perms = new Set<Permission>();
  roles.forEach((role) => {
    ROLE_PERMISSIONS[role]?.forEach((p) => perms.add(p));
  });
  return perms;
}

/** Map backend roles to OE3 internal roles */
function mapBackendRoles(backendRoles: string[]): UserRole[] {
  const roleMap: Record<string, UserRole> = {
    ADMIN: 'admin',
    SUPERADMIN: 'admin',
    RADIOLOGIST: 'physician',
    ERSTBEFUNDER: 'physician',
    ZWEITBEFUNDER: 'physician',
    MTRA: 'technologist',
    KOORDINATOR: 'viewer',
    SSB: 'viewer',
  };
  const mapped = backendRoles
    .map((r) => roleMap[r])
    .filter((r): r is UserRole => Boolean(r));
  // Deduplicate
  return [...new Set(mapped)];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cfg = getConfig();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (cfg.authMode === 'oidc' || cfg.authMode === 'smart') {
      setAuthError(`${cfg.authMode} auth not yet implemented. Set authMode to "none" in config.js.`);
      setIsLoading(false);
      return;
    }

    // Fetch current user from backend — validates JWT cookie
    // cfg.orthancUrl is "/api/v1/pacs/orthanc" — replace trailing /orthanc with /oe3-me
    const url = `${cfg.orthancUrl.replace(/\/orthanc$/, '')}/oe3-me`;
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          setUser(null);
          setAuthError(null); // Not an error — just not authenticated
          return;
        }
        if (res.status === 403) {
          setUser(null);
          setAuthError('Nur System-Administratoren duerfen auf OE3 zugreifen.');
          return;
        }
        if (!res.ok) {
          setUser(null);
          setAuthError(`Auth check failed (${res.status}).`);
          return;
        }
        const data = await res.json();
        setUser({
          id: data.id,
          displayName: data.displayName || data.email || 'User',
          email: data.email || '',
          initials: data.initials || '??',
          roles: mapBackendRoles(data.roles || []),
        });
        setAuthError(null);
      })
      .catch((err) => {
        setUser(null);
        setAuthError(`Network error: ${err.message}`);
      })
      .finally(() => setIsLoading(false));
  }, [cfg.authMode, cfg.orthancUrl]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = user ? resolvePermissions(user.roles) : new Set<Permission>();
    return {
      user,
      isAuthenticated: user !== null,
      isLoading,
      authError,
      permissions,
      hasPermission: (p: Permission) => permissions.has(p),
      hasRole: (r: UserRole) => user?.roles.includes(r) ?? false,
      signOut: () => {
        // Navigate back to admin — the cookie will expire naturally
        window.location.href = '/admin?tab=pacs';
      },
    };
  }, [user, isLoading, authError]);

  if (cfg.authMode === 'oidc') {
    throw new Error(
      'OIDC auth not yet implemented — authMode "oidc" requires Phase 2 implementation. ' +
      'Set authMode to "none" in public/config.js for local development.'
    );
  }

  if (cfg.authMode === 'smart') {
    throw new Error(
      'SMART-on-FHIR auth not yet implemented — authMode "smart" requires Phase 2 implementation. ' +
      'Set authMode to "none" in public/config.js for local development.'
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
