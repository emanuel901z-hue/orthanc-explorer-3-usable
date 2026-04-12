import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  ExternalLink, Users, BookOpen, Layers, Image, HardDrive, Trash2,
  Copy, Check, CircleDot, Info
} from 'lucide-react';
import { toast } from 'sonner';

const kpiCards = [
  { label: 'Patients', value: '34', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'Studies', value: '34', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Series', value: '307', icon: Layers, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Instances', value: '46,539', icon: Image, color: 'text-amber-500', bg: 'bg-amber-500/10' },
];

const storageUsed = 18.48;
const storageTotal = 500;

const detailedStats = [
  { label: 'Storage Size', value: '18.48 GB' },
  { label: '# Advanced Storage - Delayed Deletion: Files to delete', value: '0' },
];

const systemInfo = [
  { label: 'Orthanc Version', value: '1.12.10', copyable: true },
  { label: 'DICOM AET', value: 'ORTHANC', copyable: true },
  { label: 'Orthanc Name', value: 'ResonAit PACS', copyable: true },
  { label: 'DICOM Port', value: '4242', copyable: true },
  { label: 'Ingest transcoding', value: '', copyable: false },
  { label: 'Overwrite instances', value: 'false', copyable: false },
  { label: 'Storage Compression', value: 'false', copyable: false },
  { label: 'Read only system', value: 'false', copyable: false },
];

const plugins = [
  { name: 'Azure Blob Storage', description: 'Stores the Orthanc storage area in Azure Blob', version: '2.3.1', enabled: true },
  { name: 'dicom-web', description: 'Implementation of DICOMweb (QIDO-RS, STOW-RS and WADO-RS) and WADO-URI.', version: '1.22', enabled: true, hasOpen: true },
  { name: 'gdcm', description: 'Decoder/transcoder of medical images using GDCM.', version: '1.8', enabled: true },
  { name: 'ohif', description: 'OHIF plugin for Orthanc.', version: '1.7', enabled: true },
  { name: 'orthanc-explorer-2', description: 'Advanced User Interface for Orthanc', version: '1.10.2', enabled: true, hasOpen: true },
  { name: 'postgresql-index', description: 'Stores the Orthanc index into a PostgreSQL database', version: '10.0', enabled: true },
  { name: 'postgresql-storage', description: 'Stores the Orthanc storage area into a PostgreSQL database', version: '10.0', enabled: false },
  { name: 'stone-webviewer', description: 'Stone Web viewer', version: 'mainline', enabled: true },
  { name: 'volview', description: "Kitware's VolView for Orthanc.", version: 'mainline', enabled: true },
];

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
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </Button>
  );
}

export default function SystemInfoTab() {
  const [verbosity, setVerbosity] = useState<VerbosityLevel>('default');

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
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
                  <p className="text-sm text-muted-foreground font-mono">{storageUsed} GB / {storageTotal} GB</p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(storageUsed / storageTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            {detailedStats.map((item) => (
              <div key={item.label} className="flex justify-between py-1.5 text-sm border-t first:mt-2">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono">{item.value}</span>
              </div>
            ))}
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
                {systemInfo.map((item) => (
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
              <Badge variant="secondary" className="text-xs font-normal">{plugins.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Plugins that are loaded but not enabled or not configured correctly are shown as inactive.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plugins.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.enabled ? 'bg-emerald-500' : 'bg-destructive'}`} />
                        </TooltipTrigger>
                        <TooltipContent>{p.enabled ? 'Enabled' : 'Disabled / Not configured'}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className={`font-medium ${!p.enabled ? 'line-through text-muted-foreground' : ''}`}>
                      {p.name}
                    </TableCell>
                    <TableCell className={`text-sm text-muted-foreground ${!p.enabled ? 'line-through' : ''}`}>
                      {p.description}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.version}</TableCell>
                    <TableCell>
                      {p.hasOpen && (
                        <Button variant="outline" size="sm" className="gap-1.5 h-7">
                          Open <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
