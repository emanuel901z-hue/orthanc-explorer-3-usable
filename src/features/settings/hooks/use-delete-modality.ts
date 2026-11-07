import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteModalityAction } from "@/actions/deleteModality";

export function useDeleteModality() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteModalityAction(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["modalities"] });
      queryClient.invalidateQueries({ queryKey: ["modalities-expanded"] });
      queryClient.removeQueries({ queryKey: ["modality", name] });
    },
  });
}
