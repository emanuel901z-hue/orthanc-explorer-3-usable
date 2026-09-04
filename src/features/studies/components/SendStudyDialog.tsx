import { useCallback, useState } from 'react';
import { Send, Radio } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useModalities } from '@/features/settings/hooks/use-modalities';
import { sendStudyAction } from '@/actions/sendStudy';
import { sendSeriesAction } from '@/actions/sendSeries';
import { sendInstanceAction } from '@/actions/sendInstance';

interface ResourceInfo {
  id: string;
  patientName: string;
  studyDescription?: string;
}

interface SendStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studies: ResourceInfo[];
  /** Resource level: 'study' (default), 'series', or 'instance'. Determines which send action is used. */
  level?: 'study' | 'series' | 'instance';
}

export default function SendStudyDialog({ open, onOpenChange, studies, level = 'study' }: SendStudyDialogProps) {
  const { t } = useTranslation();
  const [selectedTarget, setSelectedTarget] = useState('');

  const { data: modalityNames = [], isLoading: modalitiesLoading } = useModalities();

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => setSelectedTarget(''), 200);
  }, [onOpenChange]);

  const sendMutation = useMutation({
    mutationFn: async ({ resourceIds, target }: { resourceIds: string[]; target: string }) => {
      if (level === 'series') {
        await Promise.all(resourceIds.map((id) => sendSeriesAction(id, target)));
      } else if (level === 'instance') {
        await Promise.all(resourceIds.map((id) => sendInstanceAction(id, target)));
      } else {
        await Promise.all(resourceIds.map((id) => sendStudyAction(id, target)));
      }
    },
    onSuccess: () => {
      toast.success(t('send.success', { level: t(`send.levels.${level}`) }));
      handleClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : t('send.error', { level: t(`send.levels.${level}`) });
      toast.error(message);
    },
  });

  const handleSend = () => {
    if (!selectedTarget) return;
    sendMutation.mutate({ resourceIds: studies.map((s) => s.id), target: selectedTarget });
  };

  const isSending = sendMutation.isPending;
  const canSend = !isSending && !!selectedTarget;
  const levelLabel = t(`send.levels.${level}`);
  const pluralLabel = studies.length === 1 ? levelLabel : `${studies.length} ${levelLabel}s`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t('send.title', { pluralLabel })}
          </DialogTitle>
          <DialogDescription>
            {t('send.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resource summary */}
          <div className="rounded-lg border p-3 space-y-1.5 max-h-32 overflow-y-auto">
            {studies.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{s.patientName}</span>
                <span className="text-muted-foreground text-xs truncate ml-2">
                  {s.studyDescription || t('send.noDescription')}
                </span>
              </div>
            ))}
          </div>

          {/* C-STORE targets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Radio className="h-3.5 w-3.5" /> C-STORE
            </div>
            {modalitiesLoading ? (
              <LoadingState label={t('common.loading')} />
            ) : modalityNames.length === 0 ? (
              <EmptyState
                icon={<Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                message={t('send.noModalities')}
                hint={t('send.addModalityHint')}
              />
            ) : (
              <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget} className="space-y-2">
                {modalityNames.map((name) => (
                  <label
                    key={name}
                    htmlFor={`target-cstore-${name}`}
                    className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem value={name} id={`target-cstore-${name}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{name}</span>
                      </div>
                    </div>
                    <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSend} disabled={!canSend} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {isSending ? t('send.sending') : t('send.sendViaCStore')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function EmptyState({ icon, message, hint }: { icon: React.ReactNode; message: string; hint: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      {icon}
      <p>{message}</p>
      <p className="text-xs mt-1">{hint}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">
      {label}
    </div>
  );
}
