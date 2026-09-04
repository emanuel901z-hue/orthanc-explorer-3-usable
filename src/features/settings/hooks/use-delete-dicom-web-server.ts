import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteDicomWebServerAction } from '@/actions/deleteDicomWebServer';

export function useDeleteDicomWebServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteDicomWebServerAction(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['dicom-web-servers'] });
      queryClient.removeQueries({ queryKey: ['dicom-web-server', name] });
    },
  });
}
