import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUiStore } from '@/store/ui-store';
import { useSystemInfo, useStats, usePlugins } from '@/features/settings/hooks/use-system-info';
import { APP_VERSION } from '@/config/version';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation();
  const { logoUrl, appName } = useUiStore();
  const { data: system } = useSystemInfo();
  const { data: stats } = useStats();
  const { data: plugins = [] } = usePlugins();

  const systemInfo = [
    { label: t('about.appVersion'), value: APP_VERSION },
    { label: t('about.orthancVersion'), value: system?.Version ?? '—' },
    { label: t('about.orthancApi'), value: system ? `v${system.ApiVersion}` : '—' },
    { label: t('about.dicomAet'), value: system?.DicomAet ?? '—' },
    { label: t('about.databaseVersion'), value: system ? String(system.DatabaseVersion) : '—' },
    { label: t('about.plugins'), value: plugins.length > 0 ? t('about.pluginsLoaded', { count: plugins.length }) : '—' },
    {
      label: t('about.storage'),
      value: stats ? t('about.storageStats', { studies: stats.CountStudies, series: stats.CountSeries, instances: stats.CountInstances }) : '—',
    },
    { label: t('about.platform'), value: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown' },
  ];

  const forkFeatures = [
    t('about.features.backendProxy'),
    t('about.features.authGate'),
    t('about.features.merge'),
    t('about.features.patientSafeMerge'),
    t('about.features.smartSearch'),
    t('about.features.rbac'),
    t('about.features.branding'),
    t('about.features.activity'),
    t('about.features.viewerConfig'),
    t('about.features.dicomweb'),
    t('about.features.i18n'),
    t('about.features.mobileCards'),
    t('about.features.columnConfig'),
    t('about.features.keyboardShortcuts'),
    t('about.features.worklists'),
    t('about.features.auditLogs'),
    t('about.features.sharing'),
    t('about.features.customButtons'),
    t('about.features.addSeries'),
    t('about.features.quickReport'),
    t('about.features.interop'),
  ];

  // the MWL broker is the largest part of this fork — it gets its own group
  const brokerFeatures = [
    t('about.features.mwlBroker'),
    t('about.features.mwlFanout'),
    t('about.features.mwlCache'),
    t('about.features.mwlSpool'),
    t('about.features.mwlRouting'),
    t('about.features.mwlLocal'),
    t('about.features.mwlStations'),
    t('about.features.mwlMpps'),
    t('about.features.mwlPir'),
    t('about.features.mwlAtna'),
    t('about.features.mwlTls'),
    t('about.features.mwlOps'),
    t('about.features.mwlRbac'),
    t('about.features.mwlIid'),
    t('about.features.mwlUps'),
    t('about.features.mwlStats'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={appName}
              className="h-10 w-10 rounded object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="flex-1">{appName || 'Orthanc Explorer 3'}</span>
            <Badge variant="secondary" className="text-[10px]">v{APP_VERSION}</Badge>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('about.description')}
        </p>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('about.systemInfo')}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {systemInfo.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-mono text-xs truncate">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('about.forkFeatures')}</h4>
          <div className="flex flex-wrap gap-1.5">
            {forkFeatures.map((feature) => (
              <Badge key={feature} variant="outline" className="text-[10px] font-normal">
                {feature}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('about.brokerFeatures')}</h4>
          <p className="text-xs text-muted-foreground">{t('about.brokerHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {brokerFeatures.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-[10px] font-normal">
                {feature}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <p className="text-[11px] text-muted-foreground text-center">
          © 2026 Orthanc Explorer 3 Usable Fork · MIT License ·
          {' '}
          <a
            href="https://github.com/emanuel901z-hue/orthanc-explorer-3-usable"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GitHub
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
