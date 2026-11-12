/**
 * Ausblenden von Kopieraufträgen — serverseitig, damit die Liste für alle
 * Benutzer gleich aussieht.
 *
 * Ausblenden löscht nichts: der Orthanc-Job bleibt als Nachweis in der
 * Historie, er erscheint nur nicht mehr in „Kopieraufträge“. Wer wirklich
 * aufräumen will, löscht den Auftrag (`deleteJobAction`) — dann ist er auch in
 * Orthanc weg.
 */
import { JSON_CONTENT_HEADERS } from '@/lib/client';
import { targetsFetch } from '@/api/targets';

type Payload = { jobIds: string[] };

export const hiddenJobsApi = {
  list: () => targetsFetch<Payload>('/copy-jobs/hidden').then((payload) => payload?.jobIds ?? []),

  hide: (jobIds: string[]) =>
    targetsFetch<Payload>('/copy-jobs/hidden', {
      method: 'POST',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ jobIds }),
    }).then((payload) => payload?.jobIds ?? []),

  /** Blendet die genannten Aufträge wieder ein; leere Liste = alle. */
  show: (jobIds: string[]) =>
    targetsFetch<Payload>('/copy-jobs/hidden', {
      method: 'DELETE',
      headers: JSON_CONTENT_HEADERS,
      body: JSON.stringify({ jobIds }),
    }).then((payload) => payload?.jobIds ?? []),
};
