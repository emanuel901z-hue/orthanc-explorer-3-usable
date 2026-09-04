/**
 * ModifyInstanceDialog — Edit DICOM tags on an instance via Orthanc /instances/:id/modify.
 *
 * Two-step flow (same as ModifyStudyDialog/ModifySeriesDialog):
 *   1. Edit: DicomTagBrowser with editable=true, user double-clicks tag values
 *   2. Review: Shows pending changes before applying
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
import { Pencil, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import DicomTagBrowser, { type TagModification, type DicomTagEntry } from '@/features/studies/components/DicomTagBrowser';
import { modifyInstanceAction } from '@/actions/modifyInstance';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrthancError } from '@/lib/errors';

interface ModifyInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceNumber: number | string;
  tags: DicomTagEntry[];
}

type Step = 'edit' | 'review';

export default function ModifyInstanceDialog({
  open,
  onOpenChange,
  instanceId,
  instanceNumber,
  tags,
}: ModifyInstanceDialogProps) {
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
    if (modifications.length === 0) return;

    const replace: Record<string, string> = {};
    for (const mod of modifications) {
      replace[mod.name] = mod.newValue;
    }

    setApplying(true);
    try {
      await modifyInstanceAction(instanceId, replace);
      toast.success(t('instance.modifySuccess', { count: modifications.length }));
      queryClient.invalidateQueries({ queryKey: ['instance', instanceId] });
      queryClient.invalidateQueries({ queryKey: ['instance-tags', instanceId] });
      handleOpenChange(false);
    } catch (e) {
      const msg = e instanceof OrthancError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Unknown error';
      toast.error(t('instance.modifyError'), { description: msg });
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
            {step === 'edit' ? t('instance.modifyTitle') : t('instance.modifyReview')}
          </DialogTitle>
          <DialogDescription>
            {step === 'edit'
              ? t('instance.modifyEditHint')
              : t('instance.modifyReviewHint', { count: modifications.length })}
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
                  <span className="font-medium">{t('instance.modifyApplyInfo')}</span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {t('instance.modifyApplyDescription', { number: instanceNumber })}
                  </p>
                </div>
              </div>

              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">{t('instance.tag')}</TableHead>
                      <TableHead className="text-xs">{t('instance.tagName')}</TableHead>
                      <TableHead className="text-xs">{t('instance.original')}</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">{t('instance.newValue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifications.map((mod) => (
                      <TableRow key={mod.tag}>
                        <TableCell className="font-mono text-xs">{mod.tag}</TableCell>
                        <TableCell className="text-xs">{mod.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground line-through">
                          {mod.originalValue || <span className="italic">{t('instance.empty')}</span>}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
                          {mod.newValue || <span className="italic">{t('instance.empty')}</span>}
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
                {modifications.length} {t('instance.changes')}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'review' && (
              <Button variant="outline" size="sm" onClick={() => setStep('edit')}>
                {t('instance.backToEditor')}
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
                {t('instance.reviewChanges', { count: modifications.length })}
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
                    {t('instance.applying')}
                  </>
                ) : (
                  t('instance.applyChanges')
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
