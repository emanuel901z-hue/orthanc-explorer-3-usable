/**
 * ShareStudyDialog — Create shareable links for studies (OE2 "EnableShares" equivalent).
 *
 * Uses the Orthanc Shares plugin if installed, otherwise generates an instant
 * viewer link with the StudyInstanceUID.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, Trash2, Loader2, Link as LinkIcon, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharesApi, type Share } from '@/api/shares';
import { toast } from 'sonner';

interface ShareStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  studyInstanceUID: string;
  patientName: string;
}

export default function ShareStudyDialog({
  open,
  onOpenChange,
  studyId,
  studyInstanceUID,
  patientName,
}: ShareStudyDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);

  // List existing shares
  const { data: shares = [], isLoading } = useQuery({
    queryKey: ['shares'],
    queryFn: () => sharesApi.list().catch(() => [] as Share[]),
    enabled: open,
  });

  const studyShares = shares.filter((s) => s.ResourceID === studyId);

  const createMutation = useMutation({
    mutationFn: () =>
      sharesApi.create({
        ResourceID: studyId,
        ResourceType: 'Study',
        Description: description || undefined,
        ExpirationTime: expirationDays > 0
          ? new Date(Date.now() + expirationDays * 86400000).toISOString()
          : undefined,
      }),
    onSuccess: (share) => {
      toast.success(t('share.created', { defaultValue: 'Share link created' }));
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      setDescription('');
      // Copy link to clipboard
      const url = `${window.location.origin}/oe3/shares/${share.ID}`;
      navigator.clipboard.writeText(url).catch(() => {});
    },
    onError: () => {
      // Fallback: generate instant viewer link
      const viewerUrl = `${window.location.origin}/oe3/viewer/${studyId}`;
      navigator.clipboard.writeText(viewerUrl).then(() => {
        toast.success(t('share.instantLinkCopied', { defaultValue: 'Instant viewer link copied to clipboard (Shares plugin not installed)' }));
      }).catch(() => {
        toast.error(t('share.createFailed', { defaultValue: 'Failed to create share' }));
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sharesApi.delete(id),
    onSuccess: () => {
      toast.success(t('share.deleted', { defaultValue: 'Share link deleted' }));
      queryClient.invalidateQueries({ queryKey: ['shares'] });
    },
  });

  const handleShareByEmail = (url: string) => {
    const subject = encodeURIComponent(`DICOM Study Share: ${patientName}`);
    const body = encodeURIComponent(`You can view the study at:\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('share.title', { defaultValue: 'Share Study' })}
          </DialogTitle>
          <DialogDescription>
            {t('share.description', { defaultValue: 'Create a shareable link for this study' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new share */}
          <div className="space-y-3 p-3 border rounded-lg">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('share.descriptionLabel', { defaultValue: 'Description (optional)' })}
              </label>
              <Input
                placeholder={t('share.descriptionPlaceholder', { defaultValue: 'For Dr. Smith... ' })}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('share.expiration', { defaultValue: 'Expiration (days)' })}
              </label>
              <Input
                type="number"
                min={0}
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                className="h-9 w-24"
              />
            </div>
            <Button
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {t('share.createLink', { defaultValue: 'Create Share Link' })}
            </Button>
          </div>

          {/* Existing shares */}
          {studyShares.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {t('share.existingLinks', { defaultValue: 'Active share links' })}
              </p>
              {studyShares.map((share) => {
                const url = `${window.location.origin}/oe3/shares/${share.ID}`;
                return (
                  <div key={share.ID} className="flex items-center gap-2 p-2 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{url}</div>
                      <div className="flex gap-2 mt-1">
                        {share.Description && <Badge variant="secondary" className="text-[10px]">{share.Description}</Badge>}
                        {share.ExpirationTime && (
                          <Badge variant="outline" className="text-[10px]">
                            {t('share.expires', { defaultValue: 'Expires' })}: {new Date(share.ExpirationTime).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleShareByEmail(url)}
                    >
                      <Mail className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => deleteMutation.mutate(share.ID)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Instant link fallback (always available) */}
          <div className="p-3 border rounded-lg bg-muted/50">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t('share.instantLink', { defaultValue: 'Instant viewer link (no expiration)' })}
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono flex-1 truncate">
                {window.location.origin}/oe3/viewer/{studyId}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/oe3/viewer/${studyId}`);
                  toast.success(t('share.linkCopied', { defaultValue: 'Link copied' }));
                }}
              >
                <Copy className="h-3 w-3" /> {t('share.copy', { defaultValue: 'Copy' })}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
