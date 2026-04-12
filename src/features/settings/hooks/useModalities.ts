import { useQuery } from "@tanstack/react-query";
import { modalitiesApi } from "@/api/modalities";

export function useModalities() {
  return useQuery({
    queryKey: ["modalities"],
    queryFn: () => modalitiesApi.list(),
  });
}
