/**
 * MoveInstancesToSeriesDialog — Re-attach selected instances to another series
 * of the same study: either an existing series or a brand-new one.
 *
 * Orthanc has no series-level merge route, and /instances/:id/modify only
 * returns a binary download (it stores nothing). The move is therefore
 * implemented via /tools/bulk-modify with Replace: SeriesInstanceUID + Force —
 * see moveInstancesToSeriesAction for the full rationale.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, FolderPlus, Loader2, AlertTriangle, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModalityBadge } from '@/shared/components/ModalityBadge';
import { useStudySeries } from '@/features/studies/hooks/use-studies';
import { instancesApi } from '@/api/instances';
import { generateDicomUid } from '@/lib/dicom-uid';
import {
  moveInstancesToSeriesAction,
  type MoveInstancesToSeriesResult,
} from '@/actions/moveInstancesToSeries';
import { toast } from 'sonner';

type Mode = 'existing' | 'new';

export interface MoveInstancesToSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  /** Series the selected instances currently belong to (excluded from the target list). */
  currentSeriesId: string;
  /** Number of instances in the current series — decides the post-move navigation. */
  currentSeriesInstanceCount: number;
  currentSeriesNumber?: number | string;
  currentSeriesDescription?: string;
  /** Orthanc IDs of the instances to move. */
  instanceIds: string[];
  onSuccess?: (
    result: MoveInstancesToSeriesResult,
    meta: { keepSource: boolean; mode: Mode },
  ) => void;
}

export function MoveInstancesToSeriesDialog({
  open,
  onOpenChange,
  studyId,
  currentSeriesId,
  currentSeriesInstanceCount,
  currentSeriesNumber,
  currentSeriesDescription,
  instanceIds,
  onSuccess,
}: MoveInstancesToSeriesDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: allSeries = [], isLoading } = useStudySeries(studyId);

  const [mode, setMode] = useState<Mode>('existing');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [keepSource, setKeepSource] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('existing');
      setSelectedSeriesId(null);
      setSearch('');
      setNewNumber('');
      setNewDescription('');
      setKeepSource(false);
    }
  }, [open]);

  const candidates = useMemo(
    () => allSeries.filter((s) => s.id !== currentSeriesId),
    [allSeries, currentSeriesId],
  );

  const nextSeriesNumber = useMemo(() => {
    const max = allSeries.reduce((m, s) => Math.max(m, Number(s.seriesNumber) || 0), 0);
    return String(max + 1);
  }, [allSeries]);

  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter(
      (s) =>
        String(s.seriesNumber ?? '').includes(term) ||
        (s.seriesDescription ?? '').toLowerCase().includes(term) ||
        s.modality.toLowerCase().includes(term) ||
        s.seriesInstanceUID.toLowerCase().includes(term),
    );
  }, [candidates, search]);

  const switchMode = (next: Mode) => {
    setMode(next);
    if (next === 'new' && !newNumber) setNewNumber(nextSeriesNumber);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (instanceIds.length === 0) throw new Error('No instances selected');

      let targetSeriesUid: string;
      let replace: Record<string, string> | undefined;
      if (mode === 'existing') {
        const target = candidates.find((s) => s.id === selectedSeriesId);
        if (!target) throw new Error('No target series selected');
        targetSeriesUid = target.seriesInstanceUID;
        // The instances join the target series, so they take over its
        // series-level attributes — DICOM PS 3.3 requires SeriesNumber and
        // SeriesDescription to be consistent within one series.
        replace = {};
        if (target.seriesNumber !== undefined && target.seriesNumber !== null) {
          const number = String(target.seriesNumber).trim();
          if (number) replace.SeriesNumber = number;
        }
        if (target.seriesDescription && target.seriesDescription.trim()) {
          replace.SeriesDescription = target.seriesDescription.trim();
        }
      } else {
        targetSeriesUid = generateDicomUid();
        replace = {};
        if (newNumber.trim()) replace.SeriesNumber = newNumber.trim();
        if (newDescription.trim()) replace.SeriesDescription = newDescription.trim();
      }

      return await moveInstancesToSeriesAction({
        instanceIds,
        targetSeriesUid,
        replace,
        keepSource,
      });
    },
    onSuccess: async (result) => {
      const failed = result.FailedInstancesCount ?? 0;
      if (failed > 0) {
        toast.warning(
          t('moveToSeries.partialFailure', {
            failed,
            defaultValue: `${failed} instance(s) could not be moved — the source instances were kept.`,
          }),
        );
      } else {
        toast.success(
          mode === 'new'
            ? t('moveToSeries.successNew', {
                count: instanceIds.length,
                defaultValue: `${instanceIds.length} instance(s) split into a new series.`,
              })
            : t('moveToSeries.success', {
                count: instanceIds.length,
                defaultValue: `${instanceIds.length} instance(s) moved.`,
              }),
        );
      }
      if (result.deleteFailures.length > 0) {
        toast.warning(
          t('moveToSeries.deleteWarning', {
            count: result.deleteFailures.length,
            defaultValue: `${result.deleteFailures.length} source instance(s) could not be removed.`,
          }),
        );
      }

      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
      queryClient.invalidateQueries({ queryKey: ['study-series'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['instances'] });

      onSuccess?.(result, { keepSource, mode });
      onOpenChange(false);

      // The current series disappears when its last instance is cut (Orthanc
      // removes empty series) — navigate to where the instances went instead.
      if (mode === 'new' && failed === 0) {
        const newInstanceId = result.Resources?.[0]?.ID;
        if (newInstanceId) {
          try {
            const inst = await instancesApi.get(newInstanceId);
            navigate(`/studies/${studyId}/series/${inst.ParentSeries}`);
          } catch {
            // Navigation is best-effort — the queries were invalidated anyway.
          }
        }
      } else if (
        mode === 'existing' &&
        !keepSource &&
        failed === 0 &&
        instanceIds.length >= currentSeriesInstanceCount &&
        selectedSeriesId
      ) {
        navigate(`/studies/${studyId}/series/${selectedSeriesId}`);
      }
    },
    onError: (err: Error) => {
      toast.error(t('moveToSeries.error', { defaultValue: 'Move failed' }), {
        description: err.message,
      });
    },
  });

  const pending = mutation.isPending;
  const canSubmit =
    instanceIds.length > 0 &&
    !pending &&
    (mode === 'existing' ? !!selectedSeriesId : true);

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t('moveToSeries.title', { defaultValue: 'Move Instances to Series' })}
          </DialogTitle>
          <DialogDescription>
            {t('moveToSeries.description', {
              defaultValue:
                'Re-attach the selected instances to another series of this study — or split them into a new series.',
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Selection summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground uppercase tracking-wide">
              {t('split.selectedInstances', { defaultValue: 'Selected instances' })}
            </span>
            <span className="font-medium text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {instanceIds.length} {t('series.instances', { defaultValue: 'instances' })}
            </span>
          </div>
          {(currentSeriesNumber !== undefined || currentSeriesDescription) && (
            <div className="flex items-center gap-1.5 text-muted-foreground pt-1 truncate">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('moveToSeries.fromSeries', { defaultValue: 'From series' })}{' '}
                {currentSeriesNumber !== undefined ? `#${currentSeriesNumber}` : ''}
                {currentSeriesDescription ? ` · ${currentSeriesDescription}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === 'existing' ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={() => switchMode('existing')}
          >
            <Layers className="h-3.5 w-3.5" />
            {t('moveToSeries.modeExisting', { defaultValue: 'Existing series' })}
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={() => switchMode('new')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t('moveToSeries.modeNew', { defaultValue: 'New series' })}
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('moveToSeries.searchPlaceholder', { defaultValue: 'Search series…' })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
                disabled={pending}
              />
            </div>
            <ScrollArea className="h-[220px] rounded-lg border">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8 px-4 text-xs text-muted-foreground">
                  {t('moveToSeries.noOtherSeries', {
                    defaultValue: 'No other series in this study.',
                  })}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCandidates.map((s) => {
                    const isSelected = selectedSeriesId === s.id;
                    return (
                      <label
                        key={s.id}
                        className={`flex items-start gap-3 p-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                        onClick={(e) => {
                          // A label click is forwarded to the nested checkbox, which
                          // would toggle a second time and undo the selection.
                          e.preventDefault();
                          setSelectedSeriesId(isSelected ? null : s.id);
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => setSelectedSeriesId(isSelected ? null : s.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {t('series.seriesNumber', { number: s.seriesNumber })}
                            </span>
                            <ModalityBadge modality={s.modality} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {s.seriesDescription || '—'} · {s.numberOfInstances}{' '}
                            {t('series.instances', { defaultValue: 'instances' })}
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {t('moveToSeries.target', { defaultValue: 'Target' })}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {selectedSeriesId && (
              <p className="text-[11px] text-muted-foreground">
                {t('moveToSeries.takesOverAttributes', {
                  defaultValue:
                    'The instances take over the number and description of the target series.',
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="move-series-number" className="text-xs">
                  {t('moveToSeries.newSeriesNumber', { defaultValue: 'Series number' })}
                </Label>
                <Input
                  id="move-series-number"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="h-8 text-xs"
                  disabled={pending}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="move-series-description" className="text-xs">
                  {t('moveToSeries.newSeriesDescription', { defaultValue: 'Series description' })}
                </Label>
                <Input
                  id="move-series-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={currentSeriesDescription || '—'}
                  className="h-8 text-xs"
                  disabled={pending}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('moveToSeries.newUidHint', {
                defaultValue:
                  'A new SeriesInstanceUID (2.25.…) is generated automatically — the instances keep their study.',
              })}
            </p>
          </div>
        )}

        {/* Options + warning */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={keepSource}
              onCheckedChange={(v) => setKeepSource(!!v)}
              disabled={pending}
            />
            <span>
              {t('moveToSeries.keepSource', {
                defaultValue: 'Keep source instances (copy instead of cut & move)',
              })}
            </span>
          </label>

          {!keepSource && instanceIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {mode === 'new'
                  ? t('moveToSeries.warningCutNew', {
                      defaultValue:
                        'The selected instances are removed from this series and moved into a new series of the study.',
                    })
                  : t('moveToSeries.warningCutExisting', {
                      defaultValue:
                        'The selected instances are removed from this series and moved into the target series.',
                    })}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'new' ? (
              <FolderPlus className="h-4 w-4" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            {t('moveToSeries.confirm', {
              count: instanceIds.length,
              defaultValue: `Move (${instanceIds.length})`,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
