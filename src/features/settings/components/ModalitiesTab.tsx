import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Pencil, Trash2, Wifi, CheckCircle2, XCircle,
  RefreshCw, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useModalities } from '@/features/settings/hooks/useModalities';
import { useModalityConfig } from '@/features/settings/hooks/useModalityConfig';
import { useEchoModality } from '@/features/settings/hooks/useEchoModality';
import { useDeleteModality } from '@/features/settings/hooks/useDeleteModality';
import { DicomModality } from '@/shared/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type EchoResult = { status: 'success' | 'failure'; at: Date };

interface ModalitiesTabProps {
  onAddClick: () => void;
  onEditClick: (modality: DicomModality) => void;
}

// Per-row sub-component so each row can call useModalityConfig independently.
function ModalityTableRow({
  name,
  echoResult,
  isEchoing,
  onEcho,
  onEdit,
  onDelete,
}: {
  name: string;
  echoResult: EchoResult | undefined;
  isEchoing: boolean;
  onEcho: (name: string) => void;
  onEdit: (m: DicomModality) => void;
  onDelete: (name: string) => void;
}) {
  const { data: config } = useModalityConfig(name);

  const modality: DicomModality = {
    id: name,
    name,
    aet: config?.AET ?? name,
    host: config?.Host ?? '—',
    port: config?.Port ?? 0,
    manufacturer: config?.Manufacturer,
  };

  const isOnline = echoResult?.status === 'success';
  const hasEchoResult = !!echoResult;

  return (
    <TableRow key={name}>
      <TableCell>
        <Tooltip>
          <TooltipTrigger>
            <span
              className={cn(
                'inline-flex items-center justify-center h-6 w-6 rounded-full',
                hasEchoResult
                  ? isOnline
                    ? 'bg-emerald-500/10'
                    : 'bg-destructive/10'
                  : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  hasEchoResult
                    ? isOnline
                      ? 'bg-emerald-500'
                      : 'bg-destructive'
                    : 'bg-muted-foreground/30',
                )}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {hasEchoResult
              ? isOnline
                ? 'Online — Last echo successful'
                : 'Offline — Last echo failed'
              : 'Not echoed yet'}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <p className="font-medium">{modality.name}</p>
      </TableCell>
      <TableCell>
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
          {modality.aet}
        </code>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {modality.host}
      </TableCell>
      <TableCell className="font-mono text-sm">
        {modality.port > 0 ? modality.port : '—'}
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground text-sm">
          {modality.manufacturer || '—'}
        </span>
      </TableCell>
      <TableCell>
        {echoResult ? (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5">
                {isOnline
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                }
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(echoResult.at, { addSuffix: true })}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{format(echoResult.at, 'PPpp')}</TooltipContent>
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
                disabled={isEchoing}
                aria-label={`Send C-ECHO to ${name}`}
                data-testid={`echo-modality-${name}`}
                onClick={() => onEcho(name)}
              >
                {isEchoing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Wifi className="h-3.5 w-3.5" />
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send C-ECHO</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label={`Edit modality ${name}`}
                onClick={() => onEdit(modality)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                aria-label={`Delete modality ${name}`}
                data-testid={`delete-modality-${name}`}
                onClick={() => onDelete(name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ModalitiesTab({ onAddClick, onEditClick }: ModalitiesTabProps) {
  const { data: modalityNames = [] } = useModalities();
  const echo = useEchoModality();
  const del = useDeleteModality();
  const [echoResults, setEchoResults] = useState<Record<string, EchoResult>>({});
  const [echoingNames, setEchoingNames] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isEchoingAll, setIsEchoingAll] = useState(false);

  const handleEcho = (name: string) => {
    setEchoingNames((prev) => new Set([...prev, name]));
    echo.mutate(name, {
      onSuccess: () => {
        setEchoResults((prev) => ({ ...prev, [name]: { status: 'success', at: new Date() } }));
        setEchoingNames((prev) => {
          const next = new Set(prev);
          next.delete(name);
          if (next.size === 0) setIsEchoingAll(false);
          return next;
        });
        toast.success(`C-ECHO to ${name} succeeded`);
      },
      onError: () => {
        setEchoResults((prev) => ({ ...prev, [name]: { status: 'failure', at: new Date() } }));
        setEchoingNames((prev) => {
          const next = new Set(prev);
          next.delete(name);
          if (next.size === 0) setIsEchoingAll(false);
          return next;
        });
        toast.error(`C-ECHO to ${name} failed`);
      },
    });
  };

  const handleEchoAll = () => {
    if (modalityNames.length === 0) return;
    setIsEchoingAll(true);
    modalityNames.forEach((name) => handleEcho(name));
  };

  const handleDelete = (name: string) => {
    del.mutate(name, {
      onSuccess: () => {
        setEchoResults((prev) => { const { [name]: _, ...rest } = prev; return rest; });
        toast.success(`Modality "${name}" deleted`);
      },
      onError: () => toast.error(`Failed to delete "${name}"`),
    });
    setPendingDelete(null);
  };

  const onlineCount = Object.values(echoResults).filter((r) => r.status === 'success').length;
  const offlineCount = Object.values(echoResults).filter((r) => r.status === 'failure').length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              DICOM modalities configured for C-STORE, C-FIND, and C-MOVE operations.
            </p>
            <div className="flex items-center gap-3 text-xs">
              {onlineCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {onlineCount} online
                </span>
              )}
              {offlineCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  {offlineCount} offline
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isEchoingAll || modalityNames.length === 0}
                  onClick={handleEchoAll}
                >
                  {isEchoingAll
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />
                  }
                  Echo All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send C-ECHO to all modalities</TooltipContent>
            </Tooltip>
            <Button type="button" size="sm" className="gap-1.5" onClick={onAddClick}>
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
              {modalityNames.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No modalities configured. Click "Add Modality" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                modalityNames.map((name) => (
                  <ModalityTableRow
                    key={name}
                    name={name}
                    echoResult={echoResults[name]}
                    isEchoing={echoingNames.has(name)}
                    onEcho={handleEcho}
                    onEdit={onEditClick}
                    onDelete={setPendingDelete}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Modality</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{pendingDelete}&quot; from Orthanc? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
