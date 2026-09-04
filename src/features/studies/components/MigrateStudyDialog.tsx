/**
 * MigrateStudyDialog — Merge source studies into a target study.
 *
 * Uses Orthanc's POST /studies/:id/merge endpoint to move all series/instances
 * from one or more source studies into the target study. Optionally deletes
 * the source studies after merge (KeepSource=false).
 *
 * Common use case: AVIEW report studies that share the same StudyInstanceUID
 * but exist as separate Orthanc resources need to be merged into the main study.
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studiesApi } from '@/api/studies';
import { mergeStudyAction } from '@/actions/mergeStudy';
import { useStudies } from '@/features/studies/hooks/use-studies';
import { formatPatientName } from '@/shared/components/ModalityBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Study } from '@/shared/types';

interface MigrateStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The target study that will receive the merged series/instances. */
  targetStudy: Study | null;
}

export default function MigrateStudyDialog({ open, onOpenChange, targetStudy }: MigrateStudyDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [keepSource, setKeepSource] = useState(false);

  // Load all studies to find potential merge sources
  const { data: allStudies = [], isLoading } = useStudies({});

  // Filter out the target study and apply search
  const candidateStudies = useMemo(() => {
    if (!targetStudy) return [];
    return allStudies.filter((s) => {
      if (s.id === targetStudy.id) return false;
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
  }, [allStudies, targetStudy, searchTerm]);

  // Highlight studies with same SIUID (likely merge candidates)
  const sameSiuidStudies = useMemo(() => {
    if (!targetStudy) return new Set<string>();
    return new Set(
      allStudies
        .filter((s) => s.id !== targetStudy.id && s.studyInstanceUID === targetStudy.studyInstanceUID)
        .map((s) => s.id),
    );
  }, [allStudies, targetStudy]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!targetStudy) throw new Error('No target study');
      const sourceIds = Array.from(selectedSourceIds);
      for (const sourceId of sourceIds) {
        await mergeStudyAction(targetStudy.id, [sourceId], keepSource);
      }
    },
    onSuccess: () => {
      toast.success(
        t('migrate.success', { count: selectedSourceIds.size }),
      );
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
      setSelectedSourceIds(new Set());
      setSearchTerm('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('migrate.error'), { description: error.message });
    },
  });

  const handleMerge = () => {
    if (selectedSourceIds.size === 0 || !targetStudy) return;
    mergeMutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedSourceIds(new Set());
      setSearchTerm('');
    }
    onOpenChange(open);
  };

  if (!targetStudy) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            {t('migrate.title')}
          </DialogTitle>
          <DialogDescription>
            {t('migrate.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Target Study Info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('migrate.targetStudy')}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{formatPatientName(targetStudy.patientName)}</span>
              <span className="text-sm text-muted-foreground ml-2">({targetStudy.patientId})</span>
            </div>
            <div className="flex items-center gap-2">
              {targetStudy.modalities.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                {format(targetStudy.studyDate, 'dd.MM.yyyy')}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            SIUID: {targetStudy.studyInstanceUID}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('migrate.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Source Studies List */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[400px] rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : candidateStudies.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t('migrate.noCandidates')}
            </div>
          ) : (
            <div className="divide-y">
              {candidateStudies.map((s) => {
                const isSameSiuid = sameSiuidStudies.has(s.id);
                const isSelected = selectedSourceIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleSource(s.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSource(s.id)}
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
                      <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        SIUID: {s.studyInstanceUID}
                      </div>
                      {isSameSiuid && (
                        <Badge variant="destructive" className="text-xs h-5 mt-1 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('migrate.sameSiuid')}
                        </Badge>
                      )}
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
            <Checkbox
              checked={keepSource}
              onCheckedChange={(v) => setKeepSource(!!v)}
            />
            <span>{t('migrate.keepSource')}</span>
          </label>

          {selectedSourceIds.size > 0 && !keepSource && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                {t('migrate.warningDelete', { count: selectedSourceIds.size })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleMerge}
              disabled={selectedSourceIds.size === 0 || mergeMutation.isPending}
              className="gap-2"
            >
              {mergeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4" />
              )}
              {t('migrate.mergeButton', { count: selectedSourceIds.size })}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
