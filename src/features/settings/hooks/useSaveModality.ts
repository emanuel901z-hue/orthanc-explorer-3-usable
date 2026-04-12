import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveModalityAction } from "@/actions/saveModality";
import type { ModalityConfig } from "@/api/modalities";

export function useSaveModality() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      config,
    }: {
      name: string;
      config: ModalityConfig;
    }) => saveModalityAction(name, config),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ["modalities"] });
      queryClient.invalidateQueries({ queryKey: ["modality", name] });
    },
  });
}
