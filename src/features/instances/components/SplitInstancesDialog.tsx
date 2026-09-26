import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Loader2, AlertTriangle, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { splitStudyAction } from '@/actions/splitStudy';
import { toast } from 'sonner';

export interface SplitInstancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  seriesDescription?: string;
  seriesNumber?: number | string;
  instanceIds: string[];
  onSuccess?: () => void;
}

export function SplitInstancesDialog({
  open,
  onOpenChange,
  studyId,
  seriesDescription,
  seriesNumber,
  instanceIds,
  onSuccess,
}: SplitInstancesDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newStudyDescription, setNewStudyDescription] = useState('');
  const [keepSource, setKeepSource] = useState(false);

  useEffect(() => {
    if (open) {
      setNewStudyDescription(
        seriesDescription ? `[Split] ${seriesDescription}` : '[Split] Instances',
      );
      setKeepSource(false);
    }
  }, [open, seriesDescription]);

  const splitMutation = useMutation({
    mutationFn: async () => {
      if (instanceIds.length === 0) throw new Error('No instances selected');

      const replace: Record<string, string> = {};
      if (newStudyDescription.trim()) {
        replace['StudyDescription'] = newStudyDescription.trim();
      }

      return await splitStudyAction(studyId, {
        Instances: instanceIds,
        KeepSource: keepSource,
        Replace: Object.keys(replace).length > 0 ? replace : undefined,
      });
    },
    onSuccess: (result) => {
      toast.success(
        t('split.successInstances', {
          count: instanceIds.length,
          defaultValue: `Successfully split ${instanceIds.length} instances into a new study.`,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      onSuccess?.();
      onOpenChange(false);
      if (result.TargetStudy) {
        navigate(`/studies/${result.TargetStudy}`);
      }
    },
    onError: (err: Error) => {
      toast.error(t('split.error', { defaultValue: 'Failed to split study' }), {
        description: err.message,
      });
    },
  });

  const handleSplit = () => {
    if (instanceIds.length === 0 || splitMutation.isPending) return;
    splitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            {t('split.titleInstances', { defaultValue: 'Split Instances to New Study' })}
          </DialogTitle>
          <DialogDescription>
            {t('split.descriptionInstances', {
              defaultValue: 'Extract selected instances into a new study with a new StudyInstanceUID.',
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Selected instances summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground uppercase tracking-wide">
              {t('split.selectedInstances', { defaultValue: 'Selected instances' })}
            </span>
            <span className="font-medium text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {instanceIds.length} {t('series.instances', { defaultValue: 'instances' })}
            </span>
          </div>
          {(seriesNumber !== undefined || seriesDescription) && (
            <div className="flex items-center gap-1.5 text-muted-foreground pt-1 truncate">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>
                {seriesNumber !== undefined ? `#${seriesNumber} · ` : ''}
                {seriesDescription || '—'}
              </span>
            </div>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="split-instance-description" className="text-xs">
              {t('split.newStudyDescription', { defaultValue: 'New Study Description' })}
            </Label>
            <Input
              id="split-instance-description"
              value={newStudyDescription}
              onChange={(e) => setNewStudyDescription(e.target.value)}
              placeholder="e.g. Follow-up Series Scan"
              className="h-8 text-xs"
              disabled={splitMutation.isPending}
            />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={keepSource}
              onCheckedChange={(v) => setKeepSource(!!v)}
              disabled={splitMutation.isPending}
            />
            <span>
              {t('split.keepSourceInstances', {
                defaultValue: 'Keep source instances (Copy instead of Cut & Move)',
              })}
            </span>
          </label>

          {!keepSource && instanceIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {t('split.warningCutInstances', {
                  defaultValue:
                    'The selected instances will be removed from this series and moved into the new study.',
                })}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={splitMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSplit}
            disabled={instanceIds.length === 0 || splitMutation.isPending}
            className="gap-1.5"
          >
            {splitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="h-4 w-4" />
            )}
            {t('split.confirm', {
              count: instanceIds.length,
              defaultValue: `Split (${instanceIds.length})`,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
