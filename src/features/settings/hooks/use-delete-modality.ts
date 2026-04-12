import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteModalityAction } from "@/actions/deleteModality";

export function useDeleteModality() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteModalityAction(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["modalities"] });
      queryClient.removeQueries({ queryKey: ["modality", name] });
    },
  });
}
