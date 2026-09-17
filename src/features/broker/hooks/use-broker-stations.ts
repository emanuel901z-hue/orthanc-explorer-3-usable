/** Audited mutations for the per-station worklist rules. */
import { brokerApi, type StationRuleIn } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';

const STATION_KEYS = [...CONFIG_KEYS, ['broker', 'station-rules']];

export function useStationRuleWrites() {
  const create = useAuditedMutation({
    action: 'broker.station_rule.create',
    resourceType: 'brokerConfig',
    run: (body: StationRuleIn) => brokerApi.stationRules.create(body),
    resourceId: (body) => body.name,
    invalidate: STATION_KEYS,
  });

  const update = useAuditedMutation({
    action: 'broker.station_rule.update',
    resourceType: 'brokerConfig',
    run: ({ id, body }: { id: number; body: StationRuleIn }) =>
      brokerApi.stationRules.update(id, body),
    resourceId: ({ body }) => body.name,
    invalidate: STATION_KEYS,
  });

  const remove = useAuditedMutation({
    action: 'broker.station_rule.delete',
    resourceType: 'brokerConfig',
    run: (id: number) => brokerApi.stationRules.remove(id),
    resourceId: (id) => String(id),
    invalidate: STATION_KEYS,
  });

  return { create, update, remove };
}
