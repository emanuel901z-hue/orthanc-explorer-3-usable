import {
  Plus, Pencil, Trash2, Globe, Shield, ShieldCheck, ShieldAlert, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useDicomWebServers } from '@/features/settings/hooks/useDicomWebServers';
import { DicomWebServer } from '@/shared/types';
import { toast } from 'sonner';

const authIcons: Record<string, typeof Shield> = {
  bearer: ShieldCheck,
  basic: Shield,
  oauth2: ShieldAlert,
  none: ShieldAlert,
};

const authColors: Record<string, string> = {
  bearer: 'text-emerald-500',
  basic: 'text-amber-500',
  oauth2: 'text-blue-500',
  none: 'text-muted-foreground',
};

interface DicomWebTabProps {
  onAddClick: () => void;
  onEditClick: (server: DicomWebServer) => void;
}

export default function DicomWebTab({ onAddClick, onEditClick }: DicomWebTabProps) {
  const { data: serverNames = [] } = useDicomWebServers();
  const dicomwebServers: DicomWebServer[] = serverNames.map((name) => ({
    id: name,
    name,
    url: '',
    authType: 'none' as const,
    hasQidoSupport: false,
    hasWadoSupport: false,
    hasStowSupport: false,
  }));
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">DICOMweb servers for WADO-RS, QIDO-RS, and STOW-RS operations.</p>
            <Badge variant="secondary" className="text-xs">{dicomwebServers.length} servers</Badge>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onAddClick}>
            <Plus className="h-3.5 w-3.5" /> Add Server
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dicomwebServers.map((s) => {
                const AuthIcon = authIcons[s.authType] || Shield;
                const authColor = authColors[s.authType] || 'text-muted-foreground';
                const capCount = [s.hasQidoSupport, s.hasWadoSupport, s.hasStowSupport].filter(Boolean).length;

                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Connected</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{capCount}/3 capabilities</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono max-w-[220px] truncate inline-block">
                            {s.url}
                          </code>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm font-mono text-xs">{s.url}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1.5">
                            <AuthIcon className={`h-3.5 w-3.5 ${authColor}`} />
                            <span className="text-sm capitalize">{s.authType}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {s.authType === 'bearer' && 'Bearer token authentication'}
                          {s.authType === 'basic' && `Basic auth (user: ${(s as any).username || 'configured'})`}
                          {s.authType === 'oauth' && 'OAuth 2.0 authentication'}
                          {s.authType === 'none' && 'No authentication'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant={s.hasQidoSupport ? 'secondary' : 'outline'}
                              className={`text-xs h-5 ${s.hasQidoSupport ? '' : 'opacity-40'}`}
                            >
                              QIDO
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{s.hasQidoSupport ? 'QIDO-RS query enabled' : 'QIDO-RS not available'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant={s.hasWadoSupport ? 'secondary' : 'outline'}
                              className={`text-xs h-5 ${s.hasWadoSupport ? '' : 'opacity-40'}`}
                            >
                              WADO
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{s.hasWadoSupport ? 'WADO-RS retrieval enabled' : 'WADO-RS not available'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant={s.hasStowSupport ? 'secondary' : 'outline'}
                              className={`text-xs h-5 ${s.hasStowSupport ? '' : 'opacity-40'}`}
                            >
                              STOW
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{s.hasStowSupport ? 'STOW-RS storage enabled' : 'STOW-RS not available'}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toast.success(`Testing connection to ${s.name}`)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Test connection</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditClick(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </TooltipProvider>
  );
}
