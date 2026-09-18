/**
 * Audited mutations for DICOM TLS.
 *
 * Generating a certificate and running an endpoint check are operator actions
 * that change or verify production behaviour, so they emit audit events like
 * every other broker write.
 */
import { brokerApi } from '@/api/broker';
import { CONFIG_KEYS, useAuditedMutation } from './use-broker-writes';
import i18n from '@/i18n';

const TLS_KEYS = [...CONFIG_KEYS, ['broker', 'tls']];

export function useTlsWrites() {
  const generate = useAuditedMutation({
    action: 'broker.tls.generate',
    resourceType: 'brokerConfig',
    run: (body: { common_name: string; days: number; san: string[]; is_ca: boolean; filename: string }) =>
      brokerApi.tls.generate(body),
    resourceId: (body) => body.common_name,
    invalidate: TLS_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  const test = useAuditedMutation({
    action: 'broker.tls.test',
    resourceType: 'brokerConfig',
    run: (body: { host: string; port: number; echo_aet?: string; server_name?: string }) =>
      brokerApi.tls.test(body),
    resourceId: (body) => `${body.host}:${body.port}`,
    invalidate: TLS_KEYS,
    successMessage: i18n.t('broker.saved'),
  });

  return { generate, test };
}
