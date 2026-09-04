/**
 * MigrateSeriesDialog — Move a series from its current study into a target study.
 *
 * Uses Orthanc's POST /studies/:id/merge endpoint with the series ID as resource.
 * The merge endpoint accepts any resource type (study, series, instance) as source.
 * When KeepSource=false, the source series is deleted after merge.
 */
import { useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, GitMerge, Loader2, Search } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studiesApi } from '@/api/studies';
import { useStudies } from '@/features/studies/hooks/use-studies';
import { formatPatientName, ModalityBadge } from '@/shared/components/ModalityBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Series } from '@/shared/types';

interface MigrateSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The series to migrate. */
  series: Series | null;
  /** The current parent study ID (will be excluded from target list). */
  currentStudyId: string;
}

export default function MigrateSeriesDialog({
  open,
  onOpenChange,
  series,
  currentStudyId,
}: MigrateSeriesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [keepSource, setKeepSource] = useState(false);

  const { data: allStudies = [], isLoading } = useStudies({});

  // Filter out the current study and apply search
  const candidateStudies = useMemo(() => {
    return allStudies.filter((s) => {
      if (s.id === currentStudyId) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        s.patientName.toLowerCase().includes(term) ||
        s.patientId.toLowerCase().includes(term) ||
        (s.studyDescription ?? '').toLowerCase().includes(term) ||
        (s.accessionNumber ?? '').toLowerCase().includes(term) ||
        s.studyInstanceUID.toLowerCase().includes(term) ||
        s.modalities.some((m) => m.toLowerCase().includes(term))
      );
    });
  }, [allStudies, currentStudyId, searchTerm]);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      if (!series || !selectedTargetId) throw new Error('No series or target selected');
      // Orthanc /studies/:id/merge accepts series IDs in the Resources array
      await studiesApi.merge(selectedTargetId, [series.id], keepSource);
    },
    onSuccess: () => {
      toast.success(t('seriesMigrate.success'));
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSelectedTargetId(null);
      setSearchTerm('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('seriesMigrate.error'), { description: error.message });
    },
  });

  const handleMigrate = () => {
    if (!selectedTargetId || !series) return;
    migrateMutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedTargetId(null);
      setSearchTerm('');
    }
    onOpenChange(open);
  };

  if (!series) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            {t('seriesMigrate.title')}
          </DialogTitle>
          <DialogDescription>{t('seriesMigrate.description')}</DialogDescription>
        </DialogHeader>

        {/* Series Info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('seriesMigrate.seriesToMigrate')}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ModalityBadge modality={series.modality} />
              <span className="font-medium">
                {t('seriesMigrate.seriesLabel', { number: series.seriesNumber })}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {series.seriesDescription || '—'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {t('seriesMigrate.currentStudy')}: {currentStudyId.substring(0, 12)}…
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('seriesMigrate.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Target Studies List */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[350px] rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : candidateStudies.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t('seriesMigrate.noCandidates')}
            </div>
          ) : (
            <div className="divide-y">
              {candidateStudies.map((s) => {
                const isSelected = selectedTargetId === s.id;
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedTargetId(isSelected ? null : s.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => setSelectedTargetId(isSelected ? null : s.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-sm">{formatPatientName(s.patientName)}</span>
                          <span className="text-xs text-muted-foreground ml-2">({s.patientId})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {s.modalities.map((m) => (
                            <Badge key={m} variant="outline" className="text-xs h-5">{m}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.studyDescription || '—'} · {format(s.studyDate, 'dd.MM.yyyy')}
                        {s.accessionNumber && ` · ACC: ${s.accessionNumber}`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Options + Actions */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={keepSource} onCheckedChange={(v) => setKeepSource(!!v)} />
            <span>{t('seriesMigrate.keepSource')}</span>
          </label>

          {selectedTargetId && !keepSource && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{t('seriesMigrate.warningDelete')}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleMigrate}
              disabled={!selectedTargetId || migrateMutation.isPending}
              className="gap-2"
            >
              {migrateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4" />
              )}
              {t('seriesMigrate.migrateButton')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
