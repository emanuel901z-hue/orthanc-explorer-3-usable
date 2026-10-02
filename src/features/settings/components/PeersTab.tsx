/**
 * PeersTab — the destinations behind "send to peer".
 *
 * Before this tab existed the peer dialog could only ever say "no peers
 * configured, edit the Orthanc configuration file": peers live in the database
 * here (`OrthancPeersInDatabase`), so there was no file to edit and no way in the
 * UI to create one. The button was a dead end.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Server, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { usePeers, useDeletePeer, usePeerConfig } from '../hooks/use-peers';
import { PeerFormDialog } from './PeerFormDialog';
import type { PeerConfig } from '@/api/peers';

/** One row: the URL and the credentials flag need the peer's own config. */
function PeerRow({ name, onEdit, onDelete }: {
  name: string;
  onEdit: (name: string, config: PeerConfig) => void;
  onDelete: (name: string) => void;
}) {
  const { t } = useTranslation();
  const { data: config, isLoading } = usePeerConfig(name);

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell className="font-mono text-xs">
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (config?.Url || '—')}
      </TableCell>
      <TableCell className="text-xs">
        {config?.Username ? t('peer.withCredentials') : t('peer.withoutCredentials')}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('peer.edit')}
            disabled={!config}
            onClick={() => config && onEdit(name, config)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('peer.remove')}
            onClick={() => onDelete(name)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PeersTab() {
  const { t } = useTranslation();
  const { data: peers = [], isLoading } = usePeers();
  const remove = useDeletePeer();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ name: string; config: PeerConfig } | null>(null);
  const [toRemove, setToRemove] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (name: string, config: PeerConfig) => { setEditing({ name, config }); setFormOpen(true); };

  const confirmRemove = () => {
    if (!toRemove) return;
    remove.mutate(toRemove, {
      onSuccess: () => {
        toast.success(t('peer.removed', { name: toRemove }));
        setToRemove(null);
      },
      onError: (error: Error) => toast.error(t('peer.removeFailed'), { description: error.message }),
    });
  };

  return (
    <Card data-testid="peers-tab">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('peer.tabHint')}</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t('peer.add')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : peers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>{t('peer.empty')}</p>
            <p className="text-xs mt-1">{t('peer.emptyHint')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('peer.name')}</TableHead>
                <TableHead>{t('peer.url')}</TableHead>
                <TableHead>{t('peer.credentials')}</TableHead>
                <TableHead className="text-right">{t('peer.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((peer) => (
                <PeerRow key={peer} name={peer} onEdit={openEdit} onDelete={setToRemove} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <PeerFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <AlertDialog open={toRemove !== null} onOpenChange={(open) => { if (!open) setToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('peer.removeTitle', { name: toRemove })}</AlertDialogTitle>
            <AlertDialogDescription>{t('peer.removeHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{t('peer.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
