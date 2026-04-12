import { useState } from 'react';
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
import { useSystemInfo, useStats, usePlugins } from '@/features/settings/hooks/use-system-info';

type VerbosityLevel = 'default' | 'verbose' | 'trace';

const verbosityDescriptions: Record<VerbosityLevel, string> = {
  default: 'Standard logging — errors and warnings only',
  verbose: 'Detailed logging — includes informational messages',
  trace: 'Full trace — logs every request and internal operation',
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
  const [verbosity, setVerbosity] = useState<VerbosityLevel>('default');
  const { data: system } = useSystemInfo();
  const { data: stats } = useStats();
  const { data: pluginNames = [] } = usePlugins();

  const kpiCards = [
    {
      label: 'Patients',
      value: stats ? String(stats.CountPatients) : '—',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Studies',
      value: stats ? String(stats.CountStudies) : '—',
      icon: BookOpen,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Series',
      value: stats ? String(stats.CountSeries) : '—',
      icon: Layers,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Instances',
      value: stats ? stats.CountInstances.toLocaleString() : '—',
      icon: Image,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  const systemInfoRows = [
    { label: 'Orthanc Version', value: system?.Version ?? '', copyable: true },
    { label: 'DICOM AET', value: system?.DicomAet ?? '', copyable: true },
    { label: 'Orthanc Name', value: system?.Name ?? '', copyable: true },
    { label: 'DICOM Port', value: system ? String(system.DicomPort) : '', copyable: true },
    { label: 'HTTP Port', value: system ? String(system.HttpPort) : '', copyable: false },
    { label: 'API Version', value: system ? String(system.ApiVersion) : '', copyable: false },
    {
      label: 'Database Version',
      value: system ? String(system.DatabaseVersion) : '',
      copyable: false,
    },
    {
      label: 'Plugins Enabled',
      value: system ? String(system.PluginsEnabled) : '',
      copyable: false,
    },
  ];

  const diskSize = stats?.TotalDiskSize ?? '—';

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
                  <p className="text-sm font-medium">Storage Usage</p>
                  <p className="text-sm text-muted-foreground font-mono">{diskSize}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orthanc System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orthanc System Info</CardTitle>
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
            <CardTitle className="text-lg">Verbosity Level</CardTitle>
            <p className="text-sm text-muted-foreground">{verbosityDescriptions[verbosity]}</p>
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
                        onClick={() => setVerbosity(level)}
                        className={`capitalize gap-1.5 ${isActive ? 'ring-2 ring-primary/30 ring-offset-1 ring-offset-background' : ''}`}
                      >
                        {isActive && <CircleDot className="h-3 w-3" />}
                        {level}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{verbosityDescriptions[level]}</TooltipContent>
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
              Installed Plugins
              <Badge variant="secondary" className="text-xs font-normal">
                {pluginNames.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Plugins installed on this Orthanc server.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pluginNames.map((name) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                  </TableRow>
                ))}
                {pluginNames.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-sm">
                      No plugins loaded
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
