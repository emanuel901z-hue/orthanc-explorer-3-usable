import { useQuery } from "@tanstack/react-query";
import { modalitiesApi } from "@/api/modalities";

export function useModalityConfig(name: string) {
  return useQuery({
    queryKey: ["modality", name],
    queryFn: () => modalitiesApi.get(name),
    enabled: !!name,
  });
}
