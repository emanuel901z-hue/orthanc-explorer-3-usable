/**
 * Audited mutations for the C-STORE spool.
 *
 * Retrying and discarding change what happens to real images, so both emit
 * BEFORE/AFTER audit events — same contract as every other broker write.
 */
import { brokerApi } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';
import i18n from '@/i18n';

const SPOOL_KEYS = [...CONFIG_KEYS, ['broker', 'spool']];

export function useBrokerSpoolWrites() {
  const retry = useAuditedMutation({
    action: 'broker.spool.retry',
    resourceType: 'brokerConfig',
    run: (id: number) => brokerApi.spool.retry(id),
    resourceId: (id) => String(id),
    invalidate: SPOOL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  const discard = useAuditedMutation({
    action: 'broker.spool.discard',
    resourceType: 'brokerConfig',
    run: ({ id, reason }: { id: number; reason: string }) => brokerApi.spool.discard(id, reason),
    resourceId: ({ id }) => String(id),
    invalidate: SPOOL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  return { retry, discard };
}
