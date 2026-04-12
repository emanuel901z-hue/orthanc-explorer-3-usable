/**
 * PermissionGuard — wraps any UI element requiring a role/permission check.
 * If the user lacks the required permission, children are not rendered.
 * Optionally renders a fallback.
 */

import { type ReactNode } from 'react';
import { useAuth, type Permission, type UserRole } from '@/app/providers/auth-context';

interface PermissionGuardProps {
  /** Required permission — user must have at least one */
  permission?: Permission | Permission[];
  /** Required role — user must have at least one */
  role?: UserRole | UserRole[];
  /** Rendered when access is denied (default: nothing) */
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({ permission, role, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission, hasRole } = useAuth();

  if (permission) {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.some(hasPermission)) return <>{fallback}</>;
  }

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.some(hasRole)) return <>{fallback}</>;
  }

  return <>{children}</>;
}
