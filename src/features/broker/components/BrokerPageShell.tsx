/**
 * Shared shell for all broker pages: not-configured guard + exactly one H1
 * (the fork's a11y contract) + title/subtitle and optional header actions.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioTower } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getConfig } from '@/config/runtime';
import { PageHelp } from './PageHelp';

export function BrokerPageShell({
  titleKey,
  subtitleKey,
  helpId,
  actions,
  children,
}: {
  titleKey: string;
  subtitleKey: string;
  /** Page id for the "what is this?" help (see `broker.help_<id>_*` texts). */
  helpId?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const configured = Boolean(getConfig().brokerUrl);

  if (!configured) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <RadioTower className="h-6 w-6" />
          {t(titleKey)}
        </h1>
        <Card className="mt-4 border-warning/30 bg-warning/5">
          <CardContent className="p-3 text-sm text-warning">
            {t('broker.notConfigured')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RadioTower className="h-6 w-6" />
            {t(titleKey)}
          </h1>
          <p className="text-sm text-muted-foreground">{t(subtitleKey)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {helpId && <PageHelp helpId={helpId} />}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
