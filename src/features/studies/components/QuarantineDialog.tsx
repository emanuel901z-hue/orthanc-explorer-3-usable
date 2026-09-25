import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { quarantineStudyAction } from '@/actions/quarantineStudy';

export interface QuarantineTarget {
  id: string;
  patientName?: string;
  studyDescription?: string;
}

interface QuarantineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One study (detail page) or the current selection (list page). */
  studies: QuarantineTarget[];
  /** Called after the run so the caller can refresh the list and clear the selection. */
  onDone?: (result: { ok: number; failed: number }) => void;
}

/**
 * Moves studies into quarantine via the PP backend (PatientID → QRN-ADOPT-*).
 * The rename happens in place, so the Orthanc study id changes — callers must
 * refresh their list afterwards.
 */
export default function QuarantineDialog({ open, onOpenChange, studies, onDone }: QuarantineDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setReason(''), 200);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      let ok = 0;
      let failed = 0;
      let firstError: string | null = null;
      let quarantinePatientId: string | null = null;
      for (const study of studies) {
        try {
          const result = await quarantineStudyAction(study.id, reason.trim() || undefined);
          quarantinePatientId = result.quarantinePatientId;
          ok += 1;
        } catch (e) {
          failed += 1;
          if (!firstError) firstError = e instanceof Error ? e.message : String(e);
        }
      }
      return { ok, failed, firstError, quarantinePatientId };
    },
    onSuccess: ({ ok, failed, firstError, quarantinePatientId }) => {
      if (ok > 0 && failed === 0) {
        toast.success(
          studies.length === 1
            ? t('studyList.quarantineDialog.success', { patientId: quarantinePatientId ?? '' })
            : t('studyList.quarantineDialog.bulkSuccess', { count: ok }),
        );
      } else if (ok > 0) {
        toast.warning(t('studyList.quarantineDialog.partial', { ok, total: studies.length, failed }));
      } else {
        toast.error(firstError || t('studyList.quarantineDialog.error'));
      }
      onDone?.({ ok, failed });
      handleClose();
    },
  });

  const running = mutation.isPending;
  const count = studies.length;

  return (
    <AlertDialog open={open} onOpenChange={() => { if (!running) handleClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {t('studyList.quarantineDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count === 1
              ? t('studyList.quarantineDialog.description')
              : t('studyList.quarantineDialog.bulkDescription', { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {count > 1 && (
          <div className="rounded-lg border p-3 space-y-1.5 max-h-32 overflow-y-auto">
            {studies.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{s.patientName || s.id}</span>
                <span className="text-muted-foreground text-xs truncate ml-2">
                  {s.studyDescription || ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="quarantine-reason">{t('studyList.quarantineDialog.reason')}</Label>
          <Input
            id="quarantine-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('studyList.quarantineDialog.reasonPlaceholder')}
            disabled={running}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            disabled={running}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('studyList.quarantineDialog.running')}
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                {t('studyList.quarantineDialog.confirm')}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
