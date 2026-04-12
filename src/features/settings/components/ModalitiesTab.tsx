import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Pencil, Trash2, Wifi, WifiOff, CheckCircle2, XCircle, Radio,
  Signal, SignalZero, Clock, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { generateDemoModalities } from '@/shared/api/mock/demo-data-generator';
import { toast } from 'sonner';

const modalities = generateDemoModalities();

interface ModalitiesTabProps {
  onAddClick: () => void;
  onEditClick: (modality: typeof modalities[number]) => void;
}

export default function ModalitiesTab({ onAddClick, onEditClick }: ModalitiesTabProps) {
  const successCount = modalities.filter((m) => m.lastEchoStatus === 'success').length;
  const failCount = modalities.filter((m) => m.lastEchoStatus !== 'success').length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">DICOM modalities configured for C-STORE, C-FIND, and C-MOVE operations.</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {successCount} online
              </span>
              {failCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  {failCount} offline
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success('Echo test sent to all modalities')}>
                  <RefreshCw className="h-3.5 w-3.5" /> Echo All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send C-ECHO to all modalities</TooltipContent>
            </Tooltip>
            <Button size="sm" className="gap-1.5" onClick={onAddClick}>
              <Plus className="h-3.5 w-3.5" /> Add Modality
            </Button>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Health</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>AET</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Last Echo</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modalities.map((m) => {
                const isOnline = m.lastEchoStatus === 'success';
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${isOnline ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isOnline ? 'Online — Last echo successful' : 'Offline — Last echo failed'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{m.aet}</code>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{m.host}</TableCell>
                    <TableCell className="font-mono text-sm">{m.port}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">{m.manufacturer || '—'}</span>
                    </TableCell>
                    <TableCell>
                      {m.lastEcho ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1.5">
                              {isOnline
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              }
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(m.lastEcho, { addSuffix: true })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{format(m.lastEcho, 'PPpp')}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toast.success(`Echo sent to ${m.name}`, { description: `${m.aet} @ ${m.host}:${m.port}` })}
                            >
                              <Wifi className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send C-ECHO</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditClick(m)}>
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
