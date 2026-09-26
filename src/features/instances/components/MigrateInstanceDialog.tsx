/**
 * MigrateInstanceDialog — Move an instance from its current series/study into a target study.
 *
 * Uses Orthanc's POST /studies/:id/merge endpoint with the instance ID as resource.
 * The merge endpoint accepts any resource type (study, series, instance) as source.
 * When KeepSource=false, the source instance is deleted after merge.
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
import { AlertTriangle, GitMerge, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mergeStudyAction } from '@/actions/mergeStudy';
import { useStudies } from '@/features/studies/hooks/use-studies';
import { formatPatientName } from '@/shared/components/ModalityBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Study } from '@/shared/types';
import { patientSignaturesMatch, type PatientSignature } from '@/lib/dicom-patient-matching';

interface MigrateInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The instance ID to migrate (single mode). */
  instanceId?: string;
  /** The instance IDs to migrate (bulk mode). */
  instanceIds?: string[];
  /** Instance number for display. */
  instanceNumber?: number | string;
  /** The current parent study ID (will be excluded from target list). */
  currentStudyId: string;
}

export default function MigrateInstanceDialog({
  open,
  onOpenChange,
  instanceId,
  instanceIds,
  instanceNumber,
  currentStudyId,
}: MigrateInstanceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [keepSource, setKeepSource] = useState(false);

  const { data: allStudies = [], isLoading } = useStudies({});

  const currentStudy = useMemo(() => allStudies.find((s) => s.id === currentStudyId), [allStudies, currentStudyId]);
  const currentSig: PatientSignature = useMemo(() => ({
    patientId: currentStudy?.patientId ?? '',
    patientName: currentStudy?.patientName ?? '',
    patientBirthDate: currentStudy?.patientBirthDate ? format(currentStudy.patientBirthDate, 'yyyyMMdd') : '',
  }), [currentStudy]);

  const studyMatchesCurrentPatient = (s: Study): boolean => {
    const targetSig: PatientSignature = {
      patientId: s.patientId ?? '',
      patientName: s.patientName ?? '',
      patientBirthDate: s.patientBirthDate ? format(s.patientBirthDate, 'yyyyMMdd') : '',
    };
    return patientSignaturesMatch(currentSig, targetSig);
  };

  const selectedTargetStudy = useMemo(() => allStudies.find((s) => s.id === selectedTargetId), [allStudies, selectedTargetId]);
  const isSelectedDifferentPatient = selectedTargetStudy ? !studyMatchesCurrentPatient(selectedTargetStudy) : false;

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

  const targetIds = useMemo(() => {
    if (instanceIds && instanceIds.length > 0) return instanceIds;
    if (instanceId) return [instanceId];
    return [];
  }, [instanceIds, instanceId]);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTargetId) throw new Error('No target selected');
      if (targetIds.length === 0) throw new Error('No instances selected');
      return await mergeStudyAction(selectedTargetId, targetIds, keepSource);
    },
    onSuccess: (result) => {
      const failedCount = result.FailedInstancesCount ?? 0;
      if (failedCount > 0) {
        toast.warning(
          t('instanceMigrate.partialSuccess', {
            failed: failedCount,
            defaultValue: `Instance migrated, but ${failedCount} instances failed.`,
          }),
        );
      } else {
        toast.success(
          targetIds.length > 1
            ? t('instanceMigrate.bulkSuccess', { count: targetIds.length, defaultValue: `${targetIds.length} instances migrated.` })
            : t('instanceMigrate.success'),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['study'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      setSelectedTargetId(null);
      setSearchTerm('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t('instanceMigrate.error'), { description: error.message });
    },
  });

  const handleMigrate = () => {
    if (!selectedTargetId) return;
    migrateMutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedTargetId(null);
      setSearchTerm('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            {t('instanceMigrate.title')}
          </DialogTitle>
          <DialogDescription>{t('instanceMigrate.description')}</DialogDescription>
        </DialogHeader>

        {/* Instance Info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {targetIds.length > 1
              ? t('instanceMigrate.instancesToMigrate', { count: targetIds.length, defaultValue: `${targetIds.length} instances to migrate` })
              : t('instanceMigrate.instanceToMigrate')}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {targetIds.length > 1
                ? `${targetIds.length} instances`
                : t('instanceMigrate.instanceLabel', { number: instanceNumber })}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {targetIds.length === 1 ? `${(instanceId ?? '').substring(0, 16)}…` : `${targetIds.length} IDs`}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('instanceMigrate.searchPlaceholder')}
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
              {t('instanceMigrate.noCandidates')}
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
                    onClick={(e) => {
                      // A label click is forwarded to the nested checkbox, which
                      // would toggle a second time and undo the selection.
                      e.preventDefault();
                      setSelectedTargetId(isSelected ? null : s.id);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {studyMatchesCurrentPatient(s) ? (
                          <Badge variant="outline" className="text-success border-success/30 text-[10px] h-5 gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {t('migrate.samePatient', { defaultValue: 'Same patient' })}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] h-5 gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {t('migrate.differentPatient', { defaultValue: 'Different patient' })}
                          </Badge>
                        )}
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
            <span>{t('instanceMigrate.keepSource')}</span>
          </label>

          {isSelectedDifferentPatient && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t('instanceMigrate.differentPatientWarning', {
                  defaultValue: 'Warning: The selected target study belongs to a different patient. Migrating will assign this instance to that patient.',
                })}
              </p>
            </div>
          )}

          {selectedTargetId && !keepSource && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{t('instanceMigrate.warningDelete')}</p>
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
              {targetIds.length > 1
                ? t('instanceMigrate.migrateButtonBulk', { count: targetIds.length, defaultValue: `Migrate (${targetIds.length})` })
                : t('instanceMigrate.migrateButton')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
