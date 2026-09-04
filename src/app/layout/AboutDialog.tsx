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

const APP_VERSION = '1.3.0';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { logoUrl, appName } = useUiStore();
  const { data: system } = useSystemInfo();
  const { data: stats } = useStats();
  const { data: plugins = [] } = usePlugins();

  const systemInfo = [
    { label: 'App Version', value: APP_VERSION },
    { label: 'Orthanc Version', value: system?.Version ?? '—' },
    { label: 'Orthanc API', value: system ? `v${system.ApiVersion}` : '—' },
    { label: 'DICOM AET', value: system?.DicomAet ?? '—' },
    { label: 'Database Version', value: system ? String(system.DatabaseVersion) : '—' },
    { label: 'Plugins', value: plugins.length > 0 ? `${plugins.length} loaded` : '—' },
    {
      label: 'Storage',
      value: stats ? `${stats.CountStudies} studies · ${stats.CountSeries} series · ${stats.CountInstances} instances` : '—',
    },
    { label: 'Platform', value: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown' },
  ];

  const forkFeatures = [
    'Backend-proxy auth mode',
    'AuthGate (SPA-level)',
    'Study/Series merge (migrate)',
    'Smart multi-token search',
    'RBAC feature flags',
    'Custom branding/logo',
    'Live Orthanc jobs in activity',
    'Viewer configuration',
    'DICOMweb server management',
    '9-language i18n',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
          Modern React/TypeScript frontend for the Orthanc DICOM server. Standalone SPA that
          connects to Orthanc's REST API — deploy as a Docker sidecar, Orthanc plugin, or behind
          a JWT-authenticated backend proxy. Study management, merge/migrate, smart search, upload,
          modality and DICOMweb configuration, viewer integration, and audit-backed actions.
        </p>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">System Information</h4>
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
          <h4 className="text-sm font-medium">Fork Features</h4>
          <div className="flex flex-wrap gap-1.5">
            {forkFeatures.map((feature) => (
              <Badge key={feature} variant="outline" className="text-[10px] font-normal">
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
