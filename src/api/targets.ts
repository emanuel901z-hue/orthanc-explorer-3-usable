/**
 * Kopierziele (nur AET) — kleiner Dienst hinter /targets-api.
 *
 * Anders als die Orthanc-Modalitäten brauchen diese Ziele keine Adresse: den
 * C-MOVE-Auftrag bekommt das Hauptarchiv. Deshalb liegen sie in einem eigenen
 * Speicher, den alle Benutzer gemeinsam sehen.
 */
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';
import { getConfig } from '@/config/runtime';

export type CopyTarget = { aet: string; label?: string };

type Payload = { targets: CopyTarget[] };

function baseUrl(): string {
  return getConfig().targetsUrl ?? '/targets-api';
}

export const targetsApi = {
  list: () => orthancFetch<Payload>(`${baseUrl()}/targets`).then((payload) => payload.targets ?? []),
  replace: (targets: CopyTarget[]) =>
    orthancFetch<Payload>(`${baseUrl()}/targets`, {
      method: 'PUT',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ targets }),
    }).then((payload) => payload.targets ?? []),
};
