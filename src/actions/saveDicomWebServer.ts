/**
 * saveDicomWebServerAction — audit-seam wrapper for creating or updating a DICOMweb server.
 *
 * Side effects:
 *   1. Calls dicomWebServersApi.put(name, config) — upserts the server in Orthanc.
 *   2. Persists UI-only metadata (auth type, capabilities) in localStorage sidecar.
 *   3. Emits an audit event (outcome: started | success | failure) via auditClient.
 *   4. Always rethrows on failure — callers must handle OrthancError.
 */
import { dicomWebServersApi, dicomWebServersMeta, type DicomWebServerConfig, type DicomWebServerMeta } from '@/api/dicomWebServers';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export interface SaveDicomWebServerInput {
  name: string;
  url: string;
  authType: DicomWebServerMeta['authType'];
  username?: string;
  clientId?: string;
  clientSecret?: string;
  hasQidoSupport: boolean;
  hasWadoSupport: boolean;
  hasStowSupport: boolean;
}

function buildOrthancConfig(input: SaveDicomWebServerInput): DicomWebServerConfig {
  const config: DicomWebServerConfig = {
    Url: input.url,
    HasDelete: false,
    ChunkedTransfers: true,
  };
  const headers: Record<string, string> = {};
  if (input.authType === 'bearer') {
    // Token must be provided by the user; we store it as a header.
    // For OAuth, the client-secret is used as a static bearer token here.
    // (Dynamic OAuth token refresh is not supported by the Orthanc DICOMweb plugin.)
    if (input.clientSecret) headers['Authorization'] = `Bearer ${input.clientSecret}`;
  } else if (input.authType === 'basic' && input.username) {
    // RFC 7617 Basic auth: "username:password" base64-encoded.
    // `clientSecret` is repurposed as the basic-auth password for DICOMweb servers
    // (the OAuth `clientSecret` field is not used in basic-auth mode).
    const password = input.clientSecret ?? '';
    headers['Authorization'] = `Basic ${btoa(`${input.username}:${password}`)}`;
  }
  if (Object.keys(headers).length > 0) config.HttpHeaders = headers;
  return config;
}

export async function saveDicomWebServerAction(input: SaveDicomWebServerInput): Promise<void> {
  const base = makeAuditBase('dicomweb.save', 'dicomWebServer', input.name);
  auditClient.emit({ ...base, outcome: 'started' });
  try {
    await dicomWebServersApi.put(input.name, buildOrthancConfig(input));
    dicomWebServersMeta.put(input.name, {
      url: input.url,
      authType: input.authType,
      username: input.username,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      hasQidoSupport: input.hasQidoSupport,
      hasWadoSupport: input.hasWadoSupport,
      hasStowSupport: input.hasStowSupport,
    });
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
