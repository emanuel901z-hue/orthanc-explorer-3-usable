import { useState } from 'react';
import {
  ExternalLink, RefreshCw, Pencil, Settings2, Monitor, Globe, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ViewerConfig {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'configured' | 'not configured';
  type: 'web' | 'desktop';
  description: string;
  enabled: boolean;
  defaultViewer: boolean;
}

const initialViewers: ViewerConfig[] = [
  {
    id: 'ohif',
    name: 'OHIF Viewer',
    url: 'https://viewer.ohif.org',
    status: 'connected',
    type: 'web',
    description: 'Open-source web-based medical imaging viewer with MPR, 3D, and segmentation support.',
    enabled: true,
    defaultViewer: true,
  },
  {
    id: 'stone',
    name: 'Stone Web Viewer',
    url: '/stone-webviewer',
    status: 'configured',
    type: 'web',
    description: 'Lightweight DICOM viewer built on the Stone of Orthanc framework.',
    enabled: true,
    defaultViewer: false,
  },
  {
    id: 'weasis',
    name: 'Weasis',
    url: 'weasis://',
    status: 'not configured',
    type: 'desktop',
    description: 'Desktop DICOM viewer with advanced tools. Requires local installation.',
    enabled: false,
    defaultViewer: false,
  },
  {
    id: 'volview',
    name: 'VolView',
    url: '/volview',
    status: 'configured',
    type: 'web',
    description: "Kitware's VolView for 3D volume rendering and visualization.",
    enabled: true,
    defaultViewer: false,
  },
];

const statusConfig = {
  connected: { dot: 'bg-emerald-500', ring: 'bg-emerald-500/10', label: 'Connected', badgeVariant: 'secondary' as const },
  configured: { dot: 'bg-amber-500', ring: 'bg-amber-500/10', label: 'Configured', badgeVariant: 'secondary' as const },
  'not configured': { dot: 'bg-muted-foreground/40', ring: 'bg-muted/50', label: 'Not Configured', badgeVariant: 'outline' as const },
};

export default function ViewerTab() {
  const [viewers, setViewers] = useState(initialViewers);
  const [editViewer, setEditViewer] = useState<ViewerConfig | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEnabled, setEditEnabled] = useState(false);

  const openEdit = (v: ViewerConfig) => {
    setEditViewer(v);
    setEditUrl(v.url);
    setEditEnabled(v.enabled);
  };

  const saveEdit = () => {
    if (!editViewer) return;
    setViewers((prev) =>
      prev.map((v) =>
        v.id === editViewer.id
          ? {
              ...v,
              url: editUrl,
              enabled: editEnabled,
              status: editEnabled && editUrl ? (editUrl.startsWith('http') || editUrl.startsWith('/') ? 'configured' : 'configured') : 'not configured',
            }
          : v
      )
    );
    toast.success(`${editViewer.name} settings saved`, { description: editUrl });
    setEditViewer(null);
  };

  const setDefault = (id: string) => {
    setViewers((prev) =>
      prev.map((v) => ({ ...v, defaultViewer: v.id === id }))
    );
    const name = viewers.find((v) => v.id === id)?.name;
    toast.success(`${name} set as default viewer`);
  };

  const testConnection = (v: ViewerConfig) => {
    toast.success(`Testing connection to ${v.name}`, { description: v.url });
  };

  const connectedCount = viewers.filter((v) => v.status === 'connected').length;
  const configuredCount = viewers.filter((v) => v.status === 'configured').length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">External DICOM viewers for opening studies directly from the explorer.</p>
            <div className="flex items-center gap-3 text-xs">
              {connectedCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {connectedCount} connected
                </span>
              )}
              {configuredCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {configuredCount} configured
                </span>
              )}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => toast.success('Connection test sent to all viewers')}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Test All
              </Button>
            </TooltipTrigger>
            <TooltipContent>Test connectivity to all configured viewers</TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {viewers.map((v) => {
            const sc = statusConfig[v.status];
            return (
              <Card key={v.id} className={`relative transition-all ${!v.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${sc.ring}`}>
                            <span className={`h-3 w-3 rounded-full ${sc.dot}`} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{sc.label}</TooltipContent>
                      </Tooltip>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{v.name}</p>
                          {v.defaultViewer && (
                            <Badge className="text-[10px] h-4 px-1.5">Default</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                            {v.type === 'web' ? <Globe className="h-2.5 w-2.5 mr-0.5" /> : <Download className="h-2.5 w-2.5 mr-0.5" />}
                            {v.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex-1 truncate">{v.url}</code>
                    {v.type === 'web' && v.enabled && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in new tab</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={!v.enabled}
                            onClick={() => testConnection(v)}
                          >
                            <RefreshCw className="h-3 w-3" /> Test
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Test viewer connectivity</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openEdit(v)}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit viewer configuration</TooltipContent>
                      </Tooltip>
                      {!v.defaultViewer && v.enabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setDefault(v.id)}
                            >
                              Set Default
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Make this the default viewer for opening studies</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Badge variant={sc.badgeVariant} className="text-xs">
                      {sc.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editViewer} onOpenChange={(open) => { if (!open) setEditViewer(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {editViewer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm">Viewer URL</Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://viewer.example.org or weasis://"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {editViewer?.type === 'web'
                  ? 'Full URL or relative path for the web-based viewer.'
                  : 'Protocol handler URL for the desktop application.'}
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Show this viewer in the study action menu</p>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditViewer(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
