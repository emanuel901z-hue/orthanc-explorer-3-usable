import { useQuery } from '@tanstack/react-query';
import { modalitiesApi } from '@/api/modalities';

export type ModalityDetail = {
  id: string;
  aet: string;
  host: string;
  port: number;
};

/**
 * Modalitäten mit Adresse: die Remote-Quellen-Seite zeigt „Host:Port“ an und
 * braucht dafür mehr als die Namen aus /modalities.
 */
export function useModalityDetails() {
  return useQuery<ModalityDetail[]>({
    queryKey: ['modalities-expanded'],
    queryFn: async () => {
      const expanded = await modalitiesApi.listExpanded();
      return Object.entries(expanded).map(([name, config]) => ({
        id: name,
        aet: config.AET || name,
        host: config.Host || '—',
        port: config.Port ?? 0,
      }));
    },
  });
}
