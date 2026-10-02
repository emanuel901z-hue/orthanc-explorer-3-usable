/**
 * Orthanc peers — the destinations behind "send to peer".
 *
 * Peers live in Orthanc (not in the broker): `OrthancPeersInDatabase` is on in
 * this stack, so they are stored in Postgres and managed over REST. That is why
 * they need a UI here — without one the "send to peer" button in a study could
 * never do anything.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peersApi, type PeerConfig } from '@/api/peers';
import { savePeerAction } from '@/actions/savePeer';
import { deletePeerAction } from '@/actions/deletePeer';

export function usePeers() {
  return useQuery({ queryKey: ['peers'], queryFn: () => peersApi.list() });
}

export function usePeerConfig(name: string | null) {
  return useQuery({
    queryKey: ['peer', name],
    queryFn: () => peersApi.get(name as string),
    enabled: Boolean(name),
  });
}

export function useSavePeer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, config, created }: {
      name: string; config: PeerConfig; created: boolean;
    }) => savePeerAction(name, config, created),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
      queryClient.invalidateQueries({ queryKey: ['peer', name] });
    },
  });
}

export function useDeletePeer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deletePeerAction(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['peers'] });
      queryClient.removeQueries({ queryKey: ['peer', name] });
    },
  });
}
