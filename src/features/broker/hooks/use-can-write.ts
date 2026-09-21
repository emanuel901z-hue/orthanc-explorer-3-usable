/**
 * useCanWrite — may this operator change the broker configuration?
 *
 * The proxy decides (role in the roles header); the broker answers once via
 * `GET /rbac/status`. Read-only work — dry-runs, C-ECHO, the TLS check — stays
 * allowed for everyone, so those buttons are *not* gated. Only actions with a
 * real side effect (sending a test message) hide behind this hook, matching the
 * broker's policy exactly.
 */
import { useQuery } from '@tanstack/react-query';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';

export function useCanWrite() {
  const configured = Boolean(getConfig().brokerUrl);
  const { data } = useQuery({
    // same key as the banner: one request, one answer
    queryKey: ['broker', 'rbac'],
    queryFn: brokerApi.rbac.status,
    enabled: configured,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  // without the proxy answer we assume the operator may write (default: off)
  return { canWrite: data ? data.can_write : true, enforced: Boolean(data?.enforced) };
}
