/**
 * Audited write operations for the MWL broker configuration.
 *
 * Every write emits a BEFORE (`started`) and an AFTER (`success`/`failure`)
 * audit event — same contract as the Orthanc write actions in `src/actions/`.
 * Broker row IDs/names are configuration identifiers, never PHI.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auditClient, type AuditResourceType } from '@/lib/audit';
import { brokerApi } from '@/api/broker';

type AuditedMutationOptions<TArgs, TResult> = {
  action: string;
  resourceType: AuditResourceType;
  run: (args: TArgs) => Promise<TResult>;
  /** Identifier for the audit event — a broker row id or config key. */
  resourceId: (args: TArgs, result: TResult | undefined) => string;
  /** Query keys to invalidate after a successful write. */
  invalidate: string[][];
};

export function useAuditedMutation<TArgs, TResult>({
  action,
  resourceType,
  run,
  resourceId,
  invalidate,
}: AuditedMutationOptions<TArgs, TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const base = { action, resourceType, resourceId: resourceId(args, undefined) };
      auditClient.emit({ ...base, outcome: 'started', timestamp: new Date().toISOString() });
      try {
        const result = await run(args);
        auditClient.emit({
          ...base,
          resourceId: resourceId(args, result),
          outcome: 'success',
          timestamp: new Date().toISOString(),
        });
        return result;
      } catch (err) {
        auditClient.emit({
          ...base,
          outcome: 'failure',
          reason: err instanceof Error ? err.message : 'unknown error',
          timestamp: new Date().toISOString(),
        });
        throw err;
      }
    },
    onSuccess: () => {
      invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export const CONFIG_KEYS = [
  ['broker', 'sources'],
  ['broker', 'targets'],
  ['broker', 'rules'],
  ['broker', 'transforms'],
  ['broker', 'settings'],
  ['broker', 'status'],
];

export function useBrokerSourceWrites() {
  const create = useAuditedMutation({
    action: 'broker.source.create',
    resourceType: 'brokerSource',
    run: (body: Parameters<typeof brokerApi.sources.create>[0]) => brokerApi.sources.create(body),
    resourceId: (args, result) => String(result?.id ?? args.name),
    invalidate: CONFIG_KEYS,
  });
  const update = useAuditedMutation({
    action: 'broker.source.update',
    resourceType: 'brokerSource',
    run: ({ id, body }: { id: number; body: Parameters<typeof brokerApi.sources.update>[1] }) =>
      brokerApi.sources.update(id, body),
    resourceId: (args) => String(args.id),
    invalidate: CONFIG_KEYS,
  });
  const remove = useAuditedMutation({
    action: 'broker.source.delete',
    resourceType: 'brokerSource',
    run: (id: number) => brokerApi.sources.delete(id),
    resourceId: (id) => String(id),
    invalidate: CONFIG_KEYS,
  });
  const resetBreaker = useAuditedMutation({
    action: 'broker.source.breaker_reset',
    resourceType: 'brokerSource',
    run: (id: number) => brokerApi.sources.resetBreaker(id),
    resourceId: (id) => String(id),
    invalidate: CONFIG_KEYS,
  });
  return { create, update, remove, resetBreaker };
}

export function useBrokerTargetWrites() {
  const create = useAuditedMutation({
    action: 'broker.target.create',
    resourceType: 'brokerTarget',
    run: (body: Parameters<typeof brokerApi.targets.create>[0]) => brokerApi.targets.create(body),
    resourceId: (args, result) => String(result?.id ?? args.name),
    invalidate: CONFIG_KEYS,
  });
  const update = useAuditedMutation({
    action: 'broker.target.update',
    resourceType: 'brokerTarget',
    run: ({ id, body }: { id: number; body: Parameters<typeof brokerApi.targets.update>[1] }) =>
      brokerApi.targets.update(id, body),
    resourceId: (args) => String(args.id),
    invalidate: CONFIG_KEYS,
  });
  const remove = useAuditedMutation({
    action: 'broker.target.delete',
    resourceType: 'brokerTarget',
    run: (id: number) => brokerApi.targets.delete(id),
    resourceId: (id) => String(id),
    invalidate: CONFIG_KEYS,
  });
  return { create, update, remove };
}

export function useBrokerRuleWrites() {
  const create = useAuditedMutation({
    action: 'broker.rule.create',
    resourceType: 'brokerRule',
    run: (body: Parameters<typeof brokerApi.rules.create>[0]) => brokerApi.rules.create(body),
    resourceId: (args, result) =>
      String(result?.id ?? `${args.source_id}->${args.target_id}`),
    invalidate: CONFIG_KEYS,
  });
  const update = useAuditedMutation({
    action: 'broker.rule.update',
    resourceType: 'brokerRule',
    run: ({ id, body }: { id: number; body: Parameters<typeof brokerApi.rules.update>[1] }) =>
      brokerApi.rules.update(id, body),
    resourceId: (args) => String(args.id),
    invalidate: CONFIG_KEYS,
  });
  const remove = useAuditedMutation({
    action: 'broker.rule.delete',
    resourceType: 'brokerRule',
    run: (id: number) => brokerApi.rules.delete(id),
    resourceId: (id) => String(id),
    invalidate: CONFIG_KEYS,
  });
  return { create, update, remove };
}

export function useBrokerTransformWrites() {
  const create = useAuditedMutation({
    action: 'broker.transform.create',
    resourceType: 'brokerTransform',
    run: (body: Parameters<typeof brokerApi.transforms.create>[0]) =>
      brokerApi.transforms.create(body),
    resourceId: (args, result) => String(result?.id ?? args.name),
    invalidate: CONFIG_KEYS,
  });
  const update = useAuditedMutation({
    action: 'broker.transform.update',
    resourceType: 'brokerTransform',
    run: ({ id, body }: { id: number; body: Parameters<typeof brokerApi.transforms.update>[1] }) =>
      brokerApi.transforms.update(id, body),
    resourceId: (args) => String(args.id),
    invalidate: CONFIG_KEYS,
  });
  const remove = useAuditedMutation({
    action: 'broker.transform.delete',
    resourceType: 'brokerTransform',
    run: (id: number) => brokerApi.transforms.delete(id),
    resourceId: (id) => String(id),
    invalidate: CONFIG_KEYS,
  });
  return { create, update, remove };
}

export function useBrokerSettingWrites() {
  const setValue = useAuditedMutation({
    action: 'broker.setting.update',
    resourceType: 'brokerSetting',
    run: ({ key, value }: { key: string; value: string }) => brokerApi.settings.set(key, value),
    resourceId: (args) => args.key,
    invalidate: CONFIG_KEYS,
  });
  const reset = useAuditedMutation({
    action: 'broker.setting.reset',
    resourceType: 'brokerSetting',
    run: (key: string) => brokerApi.settings.reset(key),
    resourceId: (key) => key,
    invalidate: CONFIG_KEYS,
  });
  return { setValue, reset };
}
