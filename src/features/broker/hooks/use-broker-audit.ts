/**
 * Audited mutations for the change log: rollback and configuration import.
 *
 * Both change production behaviour, so both emit BEFORE/AFTER audit events —
 * same contract as every other configuration write.
 */
import { brokerApi, type ConfigDocument } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';

const AUDIT_KEYS = [...CONFIG_KEYS, ['broker', 'audit']];

export function useBrokerAuditWrites() {
  const rollback = useAuditedMutation({
    action: 'broker.config.rollback',
    resourceType: 'brokerConfig',
    run: (auditId: number) => brokerApi.audit.rollback(auditId),
    resourceId: (auditId) => String(auditId),
    invalidate: AUDIT_KEYS,
  });

  const importConfig = useAuditedMutation({
    action: 'broker.config.import',
    resourceType: 'brokerConfig',
    run: (doc: ConfigDocument) => brokerApi.config.import(doc, false),
    // a hand-written document may omit arrays (the backend defaults them)
    resourceId: (doc) =>
      `${doc.sources?.length ?? 0}s/${doc.targets?.length ?? 0}t/`
      + `${doc.rules?.length ?? 0}r/${doc.transforms?.length ?? 0}m`,
    invalidate: AUDIT_KEYS,
  });

  return { rollback, importConfig };
}
