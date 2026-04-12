import { useMutation } from "@tanstack/react-query";
import { echoModalityAction } from "@/actions/echoModality";

export function useEchoModality() {
  return useMutation({
    mutationFn: (name: string) => echoModalityAction(name),
  });
}
