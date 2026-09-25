import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Share2, Loader2, Server } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { peersApi } from '@/api/peers';
import { sendToPeerAction } from '@/actions/sendToPeer';

interface SendToPeerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceLabel: string;
  resourceType?: 'study' | 'series' | 'instance';
}

export function SendToPeerDialog({
  open,
  onOpenChange,
  resourceId,
  resourceLabel,
  resourceType = 'study',
}: SendToPeerDialogProps) {
  const { t } = useTranslation();
  const [selectedPeer, setSelectedPeer] = useState<string>('');

  const { data: peers = [], isLoading } = useQuery({
    queryKey: ['peers'],
    queryFn: () => peersApi.list(),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeer) throw new Error('No peer selected');
      return await sendToPeerAction(selectedPeer, resourceId, resourceType);
    },
    onSuccess: () => {
      toast.success(
        t('peer.sendSuccess', {
          peer: selectedPeer,
          defaultValue: `Successfully sent to peer ${selectedPeer}`,
        }),
      );
      handleClose(false);
    },
    onError: (err: Error) => {
      toast.error(
        t('peer.sendError', {
          defaultValue: 'Failed to send to peer',
        }),
        { description: err.message },
      );
    },
  });

  const handleClose = (o: boolean) => {
    if (!o) setSelectedPeer('');
    onOpenChange(o);
  };

  const handleSend = () => {
    if (!selectedPeer || sendMutation.isPending) return;
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            {t('peer.sendTitle', { defaultValue: 'Send to Orthanc Peer' })}
          </DialogTitle>
          <DialogDescription>
            {t('peer.sendDescription', {
              defaultValue: 'Transfer this resource directly to another Orthanc peer via HTTP.',
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Resource summary */}
        <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
          <div className="font-medium text-foreground">{resourceLabel}</div>
          <div className="text-muted-foreground font-mono">{resourceId}</div>
        </div>

        {/* Peer selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            {t('peer.selectPeer', { defaultValue: 'Select Destination Peer' })}
          </Label>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : peers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{t('peer.noPeers', { defaultValue: 'No Orthanc peers configured.' })}</p>
              <p className="text-[11px] mt-1 text-muted-foreground/70">
                {t('peer.configureInOrthancJson', {
                  defaultValue: 'Peers can be configured in Orthanc configuration file.',
                })}
              </p>
            </div>
          ) : (
            <RadioGroup value={selectedPeer} onValueChange={setSelectedPeer} className="space-y-1.5">
              {peers.map((peer) => (
                <div
                  key={peer}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedPeer === peer ? 'bg-primary/5 border-primary/40' : ''
                  }`}
                  onClick={() => setSelectedPeer(peer)}
                >
                  <RadioGroupItem value={peer} id={`peer-${peer}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{peer}</span>
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={sendMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedPeer || sendMutation.isPending}
            className="gap-1.5"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {t('peer.send', { defaultValue: 'Send' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
