/**
 * PeerFormDialog — add or change an Orthanc peer.
 *
 * A DAU needs to know what they are filling in: the dialog says in one sentence
 * what a peer is for, and the URL field explains the shape (it must end at the
 * Orthanc root, no path). The name is immutable while editing — renaming would
 * silently create a second peer and leave the old one behind.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSavePeer } from '../hooks/use-peers';
import type { PeerConfig } from '@/api/peers';

interface PeerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create, otherwise the existing peer's name. */
  editing: { name: string; config: PeerConfig } | null;
}

export function PeerFormDialog({ open, onOpenChange, editing }: PeerFormDialogProps) {
  const { t } = useTranslation();
  const save = useSavePeer();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setUrl(editing?.config.Url ?? '');
    setUsername(editing?.config.Username ?? '');
    setPassword(editing?.config.Password ?? '');
    setTouched(false);
  }, [open, editing]);

  const nameError = !name.trim() ? t('peer.errName') : null;
  const urlError = !url.trim() ? t('peer.errUrl') : null;
  const invalid = Boolean(nameError || urlError);

  const submit = () => {
    setTouched(true);
    if (invalid || save.isPending) return;
    save.mutate(
      {
        name: name.trim(),
        created: !editing,
        config: {
          Url: url.trim(),
          ...(username.trim() ? { Username: username.trim() } : {}),
          ...(password ? { Password: password } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(editing
            ? t('peer.savedExisting', { name: name.trim() })
            : t('peer.savedNew', { name: name.trim() }));
          onOpenChange(false);
        },
        onError: (error: Error) => toast.error(t('peer.saveFailed'), {
          description: error.message,
        }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('peer.editTitle', { name: editing.name }) : t('peer.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('peer.formHint')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="peer-name">{t('peer.name')}</Label>
            <Input
              id="peer-name"
              value={name}
              disabled={Boolean(editing)}
              placeholder="pacs-kh"
              aria-invalid={touched && Boolean(nameError) || undefined}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {editing ? t('peer.nameImmutable') : t('peer.nameHint')}
            </p>
            {touched && nameError && (
              <p className="text-xs text-destructive" role="alert">{nameError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="peer-url">{t('peer.url')}</Label>
            <Input
              id="peer-url"
              value={url}
              placeholder="http://pacs-kh:8042"
              aria-invalid={touched && Boolean(urlError) || undefined}
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('peer.urlHint')}</p>
            {touched && urlError && (
              <p className="text-xs text-destructive" role="alert">{urlError}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="peer-user">{t('peer.username')}</Label>
              <Input
                id="peer-user"
                value={username}
                autoComplete="off"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="peer-pass">{t('peer.password')}</Label>
              <Input
                id="peer-pass"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('peer.credentialsHint')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
