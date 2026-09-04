import { useQuery } from '@tanstack/react-query';
import { dicomWebServersApi, dicomWebServersMeta } from '@/api/dicomWebServers';
import type { DicomWebServer } from '@/shared/types';

/**
 * Returns the list of Orthanc DICOMweb servers enriched with UI-only metadata
 * (auth type, capabilities) from the localStorage sidecar. Orthanc's API only
 * exposes server names; the sidecar fills in the rest so the UI can render
 * badges and the edit dialog can pre-fill the form.
 */
export function useDicomWebServers() {
  return useQuery({
    queryKey: ['dicom-web-servers'],
    queryFn: async (): Promise<DicomWebServer[]> => {
      const names = await dicomWebServersApi.list();
      const meta = dicomWebServersMeta.list();
      return names.map((name) => {
        const m = meta[name];
        return {
          id: name,
          name,
          url: m?.url ?? '',
          authType: m?.authType ?? 'none',
          username: m?.username,
          clientId: m?.clientId,
          clientSecret: m?.clientSecret,
          hasQidoSupport: m?.hasQidoSupport ?? false,
          hasWadoSupport: m?.hasWadoSupport ?? false,
          hasStowSupport: m?.hasStowSupport ?? false,
        };
      });
    },
  });
}
