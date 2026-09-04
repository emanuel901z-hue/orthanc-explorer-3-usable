/**
 * ModifyStudyDialog — Edit DICOM tags on a study via Orthanc /studies/:id/modify.
 *
 * Two-step flow (same as ModifySeriesDialog/ModifyInstanceDialog):
 *   1. Edit: DicomTagBrowser with editable=true, user double-clicks tag values
 *   2. Review: Shows pending changes (tag, name, original → new) before applying
 *
 * Uses modifyStudyAction (audit-seam) to call studiesApi.modify with { Replace: { ...tags } }.
 * For large studies (many instances), shows a background-job notice — Orthanc runs
 * the modify as an internal job either way; the REST call returns when queued.
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, ArrowRight, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import DicomTagBrowser, { type TagModification, type DicomTagEntry } from './DicomTagBrowser';
import { modifyStudyAction } from '@/actions/modifyStudy';
import { toast } from 'sonner';
import { OrthancError } from '@/lib/errors';

interface ModifyStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  study: {
    id: string;
    patientName: string;
    patientId: string;
    patientBirthDate?: Date;
    patientSex?: string;
    studyInstanceUID: string;
    studyDate: Date;
    studyDescription?: string;
    accessionNumber?: string;
  };
  instanceCount: number;
  /** Real study-level shared tags from Orthanc. */
  tags: DicomTagEntry[];
}

type Step = 'edit' | 'review';

// Threshold: studies above this instance count get a "may take longer" notice
const JOB_THRESHOLD = 50;

export function ModifyStudyDialog({ open, onOpenChange, study, instanceCount, tags }: ModifyStudyDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('edit');
  const [modifications, setModifications] = useState<TagModification[]>([]);
  const [applying, setApplying] = useState(false);

  const handleModificationsChange = useCallback((mods: TagModification[]) => {
    setModifications(mods);
  }, []);

  const willRunAsJob = instanceCount > JOB_THRESHOLD;

  const resetState = () => {
    setStep('edit');
    setModifications([]);
    setApplying(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  const handleApply = async () => {
    if (modifications.length === 0) return;

    // Build Replace object: { TagName: newValue, ... }
    const replace: Record<string, string> = {};
    for (const mod of modifications) {
      replace[mod.name] = mod.newValue;
    }

    setApplying(true);
    try {
      await modifyStudyAction({ ID: study.id } as Parameters<typeof modifyStudyAction>[0], {
        Replace: replace,
      });
      toast.success(t('study.modifySuccess', { count: modifications.length }));
      queryClient.invalidateQueries({ queryKey: ['study', study.id] });
      queryClient.invalidateQueries({ queryKey: ['study-shared-tags', study.id] });
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      handleOpenChange(false);
    } catch (e) {
      const msg = e instanceof OrthancError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Unknown error';
      toast.error(t('study.modifyError'), { description: msg });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {step === 'edit' ? t('study.modifyTitle') : t('study.modifyReview')}
          </DialogTitle>
          <DialogDescription>
            {step === 'edit'
              ? t('study.modifyEditHint')
              : t('study.modifyReviewHint', { count: modifications.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {step === 'edit' ? (
            <DicomTagBrowser
              study={study}
              tags={tags}
              editable
              onModificationsChange={handleModificationsChange}
            />
          ) : (
            <div className="space-y-4">
              {/* Execution info */}
              <div className={`flex items-start gap-2 p-3 rounded-lg border ${willRunAsJob ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' : 'bg-muted border-border'}`}>
                {willRunAsJob ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-amber-700 dark:text-amber-400">{t('study.modifyJobNotice')}</span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {t('study.modifyJobDescription', { count: instanceCount, threshold: JOB_THRESHOLD })}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">{t('study.modifyApplyInfo')}</span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {t('study.modifyApplyDescription', {
                          patient: study.patientName,
                          count: instanceCount,
                        })}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Changes table */}
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">{t('study.tag')}</TableHead>
                      <TableHead className="text-xs">{t('study.tagName')}</TableHead>
                      <TableHead className="text-xs">{t('study.original')}</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">{t('study.newValue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifications.map((mod) => (
                      <TableRow key={mod.tag}>
                        <TableCell className="font-mono text-xs">{mod.tag}</TableCell>
                        <TableCell className="text-xs">{mod.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground line-through">
                          {mod.originalValue || <span className="italic">{t('study.empty')}</span>}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
                          {mod.newValue || <span className="italic">{t('study.empty')}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {modifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {modifications.length} {t('study.changes')}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'review' && (
              <Button variant="outline" size="sm" onClick={() => setStep('edit')}>
                {t('study.backToEditor')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            {step === 'edit' ? (
              <Button
                size="sm"
                disabled={modifications.length === 0}
                onClick={() => setStep('review')}
              >
                {t('study.reviewChanges', { count: modifications.length })}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={applying}
                onClick={handleApply}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t('study.applying')}
                  </>
                ) : willRunAsJob ? (
                  t('study.queueModificationJob')
                ) : (
                  t('study.applyChanges')
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
