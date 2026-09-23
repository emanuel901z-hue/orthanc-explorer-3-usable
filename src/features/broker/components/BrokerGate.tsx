/**
 * BrokerGate — the broker console belongs to deployments that run the broker.
 *
 * The sidebar already hides the section unless `enableMwlBroker` is on **and**
 * `brokerUrl` is set, but the routes stayed reachable: a bookmark opened a
 * console whose every request failed. A deployment that only needs OE3 (plain
 * Orthanc, no broker) now gets a plain explanation instead of a broken page —
 * the same shape the worklists page uses for its own feature flag.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlugZap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getConfig } from '@/config/runtime';
import { useFeature } from '@/config/features';

export function BrokerGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const enabled = useFeature('mwlBroker') && Boolean(getConfig().brokerUrl);
  if (enabled) return <>{children}</>;

  return (
    <div className="p-4 sm:p-6" data-testid="broker-disabled">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="h-4 w-4" />
            {t('broker.gateTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('broker.gateHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
