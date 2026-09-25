import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Tag, Loader2 } from 'lucide-react';
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
import { addLabelAction } from '@/actions/studyLabel';

interface StudyLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One study (detail page) or the current selection (list page). */
  studyIds: string[];
  /** Labels already known to Orthanc — offered as suggestions. */
  existingLabels?: string[];
  /** Called after the run so the caller can refresh the list. */
  onDone?: (result: { ok: number; failed: number; label: string }) => void;
}

/** Adds one label to every given study (Orthanc PUT /studies/:id/labels/:label). */
export default function StudyLabelDialog({
  open,
  onOpenChange,
  studyIds,
  existingLabels = [],
  onDone,
}: StudyLabelDialogProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setLabel(''), 200);
  };

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      let ok = 0;
      let failed = 0;
      let firstError: string | null = null;
      for (const id of studyIds) {
        try {
          await addLabelAction(id, value);
          ok += 1;
        } catch (e) {
          failed += 1;
          if (!firstError) firstError = e instanceof Error ? e.message : String(e);
        }
      }
      return { ok, failed, firstError, label: value };
    },
    onSuccess: ({ ok, failed, firstError, label: applied }) => {
      if (ok > 0 && failed === 0) {
        toast.success(t('studyList.labelDialog.success', { count: ok, label: applied }));
      } else if (ok > 0) {
        toast.warning(t('studyList.labelDialog.partial', { ok, total: studyIds.length, failed }));
      } else {
        toast.error(firstError || t('studyList.labelDialog.error'));
      }
      onDone?.({ ok, failed, label: applied });
      handleClose();
    },
  });

  const trimmed = label.trim();
  const running = mutation.isPending;

  const handleApply = () => {
    if (!trimmed) {
      toast.error(t('studyList.labelDialog.missing'));
      return;
    }
    mutation.mutate(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (!running) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('studyList.labelDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('studyList.labelDialog.description', { count: studyIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="study-label">{t('studyList.labelDialog.placeholder')}</Label>
          <Input
            id="study-label"
            list="study-label-suggestions"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApply(); } }}
            placeholder={t('studyList.labelDialog.placeholder')}
            disabled={running}
            autoFocus
          />
          <datalist id="study-label-suggestions">
            {existingLabels.map((l) => <option key={l} value={l} />)}
          </datalist>
          {existingLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {existingLabels.slice(0, 12).map((l) => (
                <Button
                  key={l}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setLabel(l)}
                  disabled={running}
                >
                  {l}
                </Button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={running}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApply} disabled={running || !trimmed} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
            {running ? t('studyList.labelDialog.applying') : t('studyList.labelDialog.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
