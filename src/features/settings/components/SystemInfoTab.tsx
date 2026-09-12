import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Users, BookOpen, Layers, Image, HardDrive, Copy, Check, CircleDot } from 'lucide-react';
import { toast } from 'sonner';
import { getConfig } from '@/config/runtime';
import { useSystemInfo, useStats, usePlugins } from '@/features/settings/hooks/use-system-info';

type VerbosityLevel = 'default' | 'verbose' | 'trace';

function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return i === 0 ? `${value} ${units[i]}` : `${value.toFixed(2)} ${units[i]}`;
}

const verbosityDescriptionKeys: Record<VerbosityLevel, string> = {
  default: 'settings.verbosity.defaultDescription',
  verbose: 'settings.verbosity.verboseDescription',
  trace: 'settings.verbosity.traceDescription',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied to clipboard', { description: value });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}

export default function SystemInfoTab() {
  const { t } = useTranslation();
  const [verbosity, setVerbosity] = useState<VerbosityLevel>('default');
  const [verbosityLoading, setVerbosityLoading] = useState(false);

  // P0: Make log level control functional via Orthanc /tools/log-level
  const handleVerbosityChange = async (level: VerbosityLevel) => {
    setVerbosityLoading(true);
    try {
      const orthancUrl = getConfig().orthancUrl;
      const orthancLevel = level === 'default' ? 'warning' : level === 'verbose' ? 'info' : 'trace';
      await fetch(`${orthancUrl}/tools/log-level`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'text/plain' },
        body: orthancLevel,
      });
      setVerbosity(level);
    } catch {
      // Silently fail — non-critical setting
    } finally {
      setVerbosityLoading(false);
    }
  };
  const { data: system } = useSystemInfo();
  const { data: stats } = useStats();
  const { data: pluginNames = [] } = usePlugins();

  const kpiCards = [
    {
      label: t('settings.patients', { defaultValue: 'Patients' }),
      value: stats ? String(stats.CountPatients) : '—',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: t('settings.studies', { defaultValue: 'Studies' }),
      value: stats ? String(stats.CountStudies) : '—',
      icon: BookOpen,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: t('settings.series', { defaultValue: 'Series' }),
      value: stats ? String(stats.CountSeries) : '—',
      icon: Layers,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      label: t('settings.instances', { defaultValue: 'Instances' }),
      value: stats ? stats.CountInstances.toLocaleString() : '—',
      icon: Image,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  const systemInfoRows = [
    { label: t('settings.orthancVersion', { defaultValue: 'Orthanc Version' }), value: system?.Version ?? '', copyable: true },
    { label: t('settings.dicomAet', { defaultValue: 'DICOM AET' }), value: system?.DicomAet ?? '', copyable: true },
    { label: t('settings.orthancName', { defaultValue: 'Orthanc Name' }), value: system?.Name ?? '', copyable: true },
    { label: t('settings.dicomPort', { defaultValue: 'DICOM Port' }), value: system ? String(system.DicomPort) : '', copyable: true },
    { label: t('settings.httpPort', { defaultValue: 'HTTP Port' }), value: system ? String(system.HttpPort) : '', copyable: false },
    { label: t('settings.apiVersion', { defaultValue: 'API Version' }), value: system ? String(system.ApiVersion) : '', copyable: false },
    {
      label: t('settings.databaseVersion', { defaultValue: 'Database Version' }),
      value: system ? String(system.DatabaseVersion) : '',
      copyable: false,
    },
    {
      label: t('settings.pluginsEnabled', { defaultValue: 'Plugins Enabled' }),
      value: system ? String(system.PluginsEnabled) : '',
      copyable: false,
    },
  ];

  const diskSize = stats?.TotalDiskSizeMB
    ? formatBytes(stats.TotalDiskSizeMB * 1024 * 1024)
    : stats?.TotalDiskSize
      ? formatBytes(parseInt(stats.TotalDiskSize, 10))
      : '—';

  const diskSizeRaw = stats?.TotalDiskSize
    ? `${parseInt(stats.TotalDiskSize, 10).toLocaleString()} bytes`
    : undefined;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}
                  >
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Storage Card */}
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="text-sm font-medium">{t('settings.storageUsage', { defaultValue: 'Storage Usage' })}</p>
                  <p className="text-sm text-muted-foreground font-mono" title={diskSizeRaw}>{diskSize}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orthanc System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('settings.orthancSystemInfo', { defaultValue: 'Orthanc System Info' })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {systemInfoRows.map((item) => (
                  <TableRow key={item.label} className="group">
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono text-sm">{item.value || '—'}</span>
                        {item.copyable && item.value && <CopyButton value={item.value} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Verbosity Level */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('settings.verbosity.title', { defaultValue: 'Verbosity Level' })}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(verbosityDescriptionKeys[verbosity], { defaultValue: verbosity })}</p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(['default', 'verbose', 'trace'] as VerbosityLevel[]).map((level) => {
                const isActive = verbosity === level;
                return (
                  <Tooltip key={level}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleVerbosityChange(level)}
                        disabled={verbosityLoading}
                        className={`capitalize gap-1.5 ${isActive ? 'ring-2 ring-primary/30 ring-offset-1 ring-offset-background' : ''}`}
                      >
                        {isActive && <CircleDot className="h-3 w-3" />}
                        {t(`settings.verbosity.${level}`, { defaultValue: level })}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t(verbosityDescriptionKeys[level], { defaultValue: level })}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Installed Plugins */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t('settings.installedPlugins', { defaultValue: 'Installed Plugins' })}
              <Badge variant="secondary" className="text-xs font-normal">
                {pluginNames.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('settings.installedPluginsHint', { defaultValue: 'Plugins installed on this Orthanc server.' })}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pluginNames.map((name) => {
                  // Show status badges for known plugins
                  const isKnown = ['gdcm', 'dicomweb', 'postgresql', 'nifti', 'housekeeper', 'advanced-storage', 'transfers', 'wsi', 'ohif', 'multitenant', 'auth-service', 'delayed-deletion'].includes(name.toLowerCase());
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <Badge variant={isKnown ? 'default' : 'secondary'} className="text-xs">
                          {isKnown
                            ? t('settings.pluginActive', { defaultValue: 'Active' })
                            : t('settings.pluginLoaded', { defaultValue: 'Loaded' })}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pluginNames.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-sm" colSpan={2}>
                      {t('settings.noPluginsLoaded', { defaultValue: 'No plugins loaded' })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
