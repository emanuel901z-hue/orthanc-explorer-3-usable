import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Loader2, AlertTriangle } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModalityBadge, formatPatientName } from '@/shared/components/ModalityBadge';
import { splitStudyAction } from '@/actions/splitStudy';
import { toast } from 'sonner';
import type { Study, Series } from '@/shared/types';

interface SplitStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  study: Study;
  seriesList: Series[];
  preselectedSeriesIds?: string[];
}

export function SplitStudyDialog({
  open,
  onOpenChange,
  study,
  seriesList,
  preselectedSeriesIds,
}: SplitStudyDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(new Set());
  const [newStudyDescription, setNewStudyDescription] = useState('');
  const [keepSource, setKeepSource] = useState(false);

  useEffect(() => {
    if (open) {
      if (preselectedSeriesIds && preselectedSeriesIds.length > 0) {
        setSelectedSeriesIds(new Set(preselectedSeriesIds));
      } else {
        setSelectedSeriesIds(new Set());
      }
      setNewStudyDescription(
        study.studyDescription ? `[Split] ${study.studyDescription}` : 'Split Study',
      );
      setKeepSource(false);
    }
  }, [open, preselectedSeriesIds, study]);

  const toggleSeries = (id: string) => {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedSeriesIds.size === seriesList.length) {
      setSelectedSeriesIds(new Set());
    } else {
      setSelectedSeriesIds(new Set(seriesList.map((s) => s.id)));
    }
  };

  const splitMutation = useMutation({
    mutationFn: async () => {
      const seriesIds = Array.from(selectedSeriesIds);
      if (seriesIds.length === 0) throw new Error('No series selected');

      const replace: Record<string, string> = {};
      if (newStudyDescription.trim()) {
        replace['StudyDescription'] = newStudyDescription.trim();
      }

      return await splitStudyAction(study.id, {
        Series: seriesIds,
        KeepSource: keepSource,
        Replace: Object.keys(replace).length > 0 ? replace : undefined,
      });
    },
    onSuccess: (result) => {
      toast.success(
        t('split.success', {
          count: selectedSeriesIds.size,
          defaultValue: `Successfully split ${selectedSeriesIds.size} series into a new study.`,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
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
    if (selectedSeriesIds.size === 0 || splitMutation.isPending) return;
    splitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            {t('split.title', { defaultValue: 'Split Study' })}
          </DialogTitle>
          <DialogDescription>
            {t('split.description', {
              defaultValue: 'Extract selected series into a new study with a new StudyInstanceUID.',
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Source study summary */}
        <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">{formatPatientName(study.patientName)}</span>
            <span className="font-mono text-muted-foreground">{study.patientId}</span>
          </div>
          <div className="text-muted-foreground truncate">{study.studyDescription || '—'}</div>
        </div>

        {/* Series Selection list */}
        <div className="space-y-2 flex-1 min-h-[220px] flex flex-col">
          <div className="flex items-center justify-between text-xs">
            <Label className="font-semibold text-muted-foreground uppercase">
              {t('split.selectSeries', { defaultValue: 'Select Series to Extract' })}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={selectAll}
            >
              {selectedSeriesIds.size === seriesList.length
                ? t('split.deselectAll', { defaultValue: 'Deselect all' })
                : t('split.selectAll', { defaultValue: 'Select all' })}
            </Button>
          </div>

          <ScrollArea className="flex-1 rounded-lg border max-h-[280px]">
            <div className="divide-y">
              {seriesList.map((s) => {
                const isSelected = selectedSeriesIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleSeries(s.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSeries(s.id)}
                    />
                    <ModalityBadge modality={s.modality} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">
                          {s.seriesDescription || t('series.noDescription', { defaultValue: 'Series' })}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{s.seriesNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{s.numberOfInstances} {t('series.instances', { defaultValue: 'instances' })}</span>
                        <span className="font-mono truncate">{s.seriesInstanceUID}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1">
            <Label htmlFor="split-description" className="text-xs">
              {t('split.newStudyDescription', { defaultValue: 'New Study Description' })}
            </Label>
            <Input
              id="split-description"
              value={newStudyDescription}
              onChange={(e) => setNewStudyDescription(e.target.value)}
              placeholder="e.g. Thorax CT (Follow-up)"
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
            <span>{t('split.keepSource', { defaultValue: 'Keep source series (Copy instead of Cut & Move)' })}</span>
          </label>

          {!keepSource && selectedSeriesIds.size > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {t('split.warningCut', {
                  defaultValue: 'The selected series will be removed from this study and moved into the new study.',
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
            disabled={selectedSeriesIds.size === 0 || splitMutation.isPending}
            className="gap-1.5"
          >
            {splitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scissors className="h-4 w-4" />
            )}
            {t('split.confirm', {
              count: selectedSeriesIds.size,
              defaultValue: `Split (${selectedSeriesIds.size})`,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
