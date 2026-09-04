/**
 * ModifySeriesDialog — Edit DICOM tags on a series via Orthanc /series/:id/modify.
 *
 * Two-step flow:
 *   1. Edit: DicomTagBrowser with editable=true, user double-clicks tag values
 *   2. Review: Shows pending changes (tag, name, original → new) before applying
 *
 * Uses modifySeriesAction (audit-seam) to call seriesApi.modify with { Replace: { ...tags } }.
 */
import { useState, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, ArrowRight, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import DicomTagBrowser, { type TagModification, type DicomTagEntry } from '@/features/studies/components/DicomTagBrowser';
import { modifySeriesAction } from '@/actions/modifySeries';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrthancError } from '@/lib/errors';
import type { Series } from '@/shared/types';

interface ModifySeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: Series | null;
  /** Series-level shared tags from Orthanc. */
  tags: DicomTagEntry[];
}

type Step = 'edit' | 'review';

export default function ModifySeriesDialog({
  open,
  onOpenChange,
  series,
  tags,
}: ModifySeriesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('edit');
  const [modifications, setModifications] = useState<TagModification[]>([]);
  const [applying, setApplying] = useState(false);

  const handleModificationsChange = useCallback((mods: TagModification[]) => {
    setModifications(mods);
  }, []);

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
    if (modifications.length === 0 || !series) return;

    // Build Replace object: { TagName: newValue, ... }
    const replace: Record<string, string> = {};
    for (const mod of modifications) {
      // Use the DICOM keyword (tag name) as the key
      replace[mod.name] = mod.newValue;
    }

    setApplying(true);
    try {
      await modifySeriesAction(series.id, replace);
      toast.success(t('series.modifySuccess', { count: modifications.length }));
      queryClient.invalidateQueries({ queryKey: ['series', series.id] });
      queryClient.invalidateQueries({ queryKey: ['series-shared-tags', series.id] });
      handleOpenChange(false);
    } catch (e) {
      const msg = e instanceof OrthancError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Unknown error';
      toast.error(t('series.modifyError'), { description: msg });
    } finally {
      setApplying(false);
    }
  };

  if (!series) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {step === 'edit' ? t('series.modifyTitle') : t('series.modifyReview')}
          </DialogTitle>
          <DialogDescription>
            {step === 'edit'
              ? t('series.modifyEditHint')
              : t('series.modifyReviewHint', { count: modifications.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {step === 'edit' ? (
            <DicomTagBrowser
              study={{
                patientName: '',
                patientId: '',
                studyInstanceUID: '',
                studyDate: new Date(0),
              }}
              tags={tags}
              editable
              onModificationsChange={handleModificationsChange}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted border-border">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">{t('series.modifyApplyInfo')}</span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {t('series.modifyApplyDescription', { series: series.seriesDescription || series.seriesInstanceUID })}
                  </p>
                </div>
              </div>

              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">{t('series.tag')}</TableHead>
                      <TableHead className="text-xs">{t('series.tagName')}</TableHead>
                      <TableHead className="text-xs">{t('series.original')}</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">{t('series.newValue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifications.map((mod) => (
                      <TableRow key={mod.tag}>
                        <TableCell className="font-mono text-xs">{mod.tag}</TableCell>
                        <TableCell className="text-xs">{mod.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground line-through">
                          {mod.originalValue || <span className="italic">{t('series.empty')}</span>}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
                          {mod.newValue || <span className="italic">{t('series.empty')}</span>}
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
                {modifications.length} {t('series.changes')}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'review' && (
              <Button variant="outline" size="sm" onClick={() => setStep('edit')}>
                {t('series.backToEditor')}
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
                {t('series.reviewChanges', { count: modifications.length })}
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
                    {t('series.applying')}
                  </>
                ) : (
                  t('series.applyChanges')
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
