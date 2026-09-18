/**
 * Audited mutations for the local worklist and the HL7 intake.
 *
 * Local items are real worklist data — every change is audited, and the HL7
 * dry-run never writes (it only reports what the parser understood).
 */
import { brokerApi, type LocalItemIn } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';
import i18n from '@/i18n';

const LOCAL_KEYS = [...CONFIG_KEYS, ['broker', 'local-items'], ['broker', 'hl7']];

export function useLocalItemWrites() {
  const create = useAuditedMutation({
    action: 'broker.local_item.create',
    resourceType: 'brokerConfig',
    run: (body: LocalItemIn) => brokerApi.localItems.create(body),
    resourceId: (body) => body.accession,
    invalidate: LOCAL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  const update = useAuditedMutation({
    action: 'broker.local_item.update',
    resourceType: 'brokerConfig',
    run: ({ id, body }: { id: number; body: LocalItemIn }) =>
      brokerApi.localItems.update(id, body),
    resourceId: ({ body }) => body.accession,
    invalidate: LOCAL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  const remove = useAuditedMutation({
    action: 'broker.local_item.delete',
    resourceType: 'brokerConfig',
    run: (id: number) => brokerApi.localItems.remove(id),
    resourceId: (id) => String(id),
    invalidate: LOCAL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  return { create, update, remove };
}

export function useHl7Writes() {
  const apply = useAuditedMutation({
    action: 'broker.hl7.orm',
    resourceType: 'brokerConfig',
    run: ({ message, dryRun }: { message: string; dryRun: boolean }) =>
      brokerApi.hl7.orm(message, dryRun),
    resourceId: (args, result) => result?.accession ?? args.dryRun ? 'dry-run' : 'orm',
    invalidate: LOCAL_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  return { apply };
}
