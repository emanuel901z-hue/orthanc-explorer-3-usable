import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditStore } from '@/store/audit-store';
import { ActivitySeverity } from '@/shared/types/activity';
import { useAuth } from '@/app/providers/auth-context';

interface AuditOptions {
  action: string;
  title: string;
  severity?: ActivitySeverity;
  description?: string;
  resource?: string;
  metadata?: Record<string, string>;
}

export function useAuditLog() {
  const { t } = useTranslation();
  const log = useAuditStore((s) => s.log);
  const { user } = useAuth();

  const audit = useCallback(
    (opts: AuditOptions) => {
      log({
        category: 'audit',
        severity: opts.severity ?? 'info',
        action: opts.action,
        title: opts.title,
        description: opts.description,
        resource: opts.resource,
        actor: user ? (user.displayName || user.email) : undefined,
        metadata: {
          ...opts.metadata,
          ...(user?.email ? { [t('activity.metadata.userEmail')]: user.email } : {}),
          [t('activity.metadata.origin')]: t('activity.metadata.webUi'),
        },
      });
    },
    [log, user, t],
  );

  return { audit };
}
