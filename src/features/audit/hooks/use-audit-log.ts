import { useCallback } from 'react';
import { useAuditStore } from '@/store/audit-store';
import { ActivitySeverity } from '@/shared/types/activity';

interface AuditOptions {
  action: string;
  title: string;
  severity?: ActivitySeverity;
  description?: string;
  resource?: string;
  metadata?: Record<string, string>;
}

export function useAuditLog() {
  const log = useAuditStore((s) => s.log);

  const audit = useCallback(
    (opts: AuditOptions) => {
      log({
        category: 'audit',
        severity: opts.severity ?? 'info',
        action: opts.action,
        title: opts.title,
        description: opts.description,
        resource: opts.resource,
        actor: 'Current User',
        metadata: {
          ...opts.metadata,
          'IP Address': '192.168.1.42',
          'User Agent': navigator.userAgent.slice(0, 60),
        },
      });
    },
    [log]
  );

  return { audit };
}
