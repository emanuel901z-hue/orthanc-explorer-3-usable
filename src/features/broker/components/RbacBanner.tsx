/**
 * RbacBanner — tells a read-only operator why the write actions are disabled.
 *
 * The proxy decides who may change the broker configuration (role `brokerWrite`
 * in the roles header). Instead of letting the operator run into 403s, the UI
 * asks once and states plainly what is missing.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { brokerApi } from '@/api/broker';
import { getConfig } from '@/config/runtime';

export function RbacBanner() {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);

  const statusQuery = useQuery({
    queryKey: ['broker', 'rbac'],
    queryFn: brokerApi.rbac.status,
    enabled: configured,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const status = statusQuery.data;

  if (!status?.enforced || status.can_write) {
    return null;
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5" data-testid="rbac-banner">
      <CardContent className="p-3 text-sm text-amber-700">
        {t('broker.rbacReadonly', { role: status.write_role })}
      </CardContent>
    </Card>
  );
}
