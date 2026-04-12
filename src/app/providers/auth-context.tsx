/**
 * Authentication context.
 * Provides current user, roles, and permissions.
 * In demo mode a mock user is used; the structure is production-ready
 * for plugging in real auth (e.g. OIDC, SMART on FHIR).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
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
  permissions: Set<Permission>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  /** Sign out — in demo mode this is a no-op */
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Demo user — used when no real auth provider is configured */
const DEMO_USER: AuthUser = {
  id: 'demo-user-001',
  displayName: 'Dr. Sarah Chen',
  email: 's.chen@hospital.org',
  initials: 'SC',
  roles: ['admin'],
};

function resolvePermissions(roles: UserRole[]): Set<Permission> {
  const perms = new Set<Permission>();
  roles.forEach((role) => {
    ROLE_PERMISSIONS[role]?.forEach((p) => perms.add(p));
  });
  return perms;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cfg = getConfig();

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

  const user = DEMO_USER;

  const value = useMemo<AuthContextValue>(() => {
    const permissions = resolvePermissions(user.roles);
    return {
      user,
      isAuthenticated: true,
      permissions,
      hasPermission: (p: Permission) => permissions.has(p),
      hasRole: (r: UserRole) => user.roles.includes(r),
      signOut: () => {
        // TODO: Implement real sign-out
      },
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
