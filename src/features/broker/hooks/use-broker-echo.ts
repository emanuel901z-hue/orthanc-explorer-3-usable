/**
 * Manual C-ECHO trigger for one source/target.
 *
 * Deliberately NOT audited: a connectivity test changes no configuration.
 * The result is surfaced through the polled /status snapshot.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { brokerApi } from '@/api/broker';

export type EchoTarget = { kind: 'source' | 'target'; id: number };

export function useBrokerEcho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: EchoTarget) =>
      kind === 'source' ? brokerApi.sources.echo(id) : brokerApi.targets.echo(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['broker', 'status'] }),
  });
}
