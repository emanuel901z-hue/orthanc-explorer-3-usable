/**
 * Audited mutations for DICOM TLS.
 *
 * Generating a certificate and running an endpoint check are operator actions
 * that change or verify production behaviour, so they emit audit events like
 * every other broker write.
 */
import { brokerApi } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';
import { useTranslation } from 'react-i18next';

const TLS_KEYS = [...CONFIG_KEYS, ['broker', 'tls']];

export function useTlsWrites() {
  const { t } = useTranslation();
  const generate = useAuditedMutation({
    action: 'broker.tls.generate',
    resourceType: 'brokerConfig',
    run: (body: { common_name: string; days: number; san: string[]; is_ca: boolean; filename: string }) =>
      brokerApi.tls.generate(body),
    resourceId: (body) => body.common_name,
    invalidate: TLS_KEYS,
    successMessage: t('broker.saved'),
  });

  /** Install a certificate/key pair that came from the hospital PKI. */
  const upload = useAuditedMutation({
    action: 'broker.tls.upload',
    resourceType: 'brokerConfig',
    run: (body: { certificate_pem: string; key_pem: string; ca_pem?: string;
                  filename?: string; is_ca?: boolean }) =>
      brokerApi.tls.upload(body),
    resourceId: (body) => body.filename ?? 'uploaded',
    invalidate: TLS_KEYS,
    successMessage: t('broker.tlsUploaded'),
  });

  const test = useAuditedMutation({
    action: 'broker.tls.test',
    resourceType: 'brokerConfig',
    run: (body: { host: string; port: number; echo_aet?: string; server_name?: string }) =>
      brokerApi.tls.test(body),
    resourceId: (body) => `${body.host}:${body.port}`,
    invalidate: TLS_KEYS,
    successMessage: t('broker.saved'),
  });

  return { generate, upload, test };
}
