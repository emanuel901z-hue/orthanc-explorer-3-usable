import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveDicomWebServerAction, type SaveDicomWebServerInput } from '@/actions/saveDicomWebServer';

export function useSaveDicomWebServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveDicomWebServerInput) => saveDicomWebServerAction(input),
    onSuccess: (_data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ['dicom-web-servers'] });
      queryClient.invalidateQueries({ queryKey: ['dicom-web-server', name] });
    },
  });
}
