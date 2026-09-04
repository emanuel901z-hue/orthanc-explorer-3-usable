import { useState } from 'react';
import { Shield } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAnonymizeJob } from '@/features/tasks/hooks/use-anonymize-job';

interface AnonymizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: 'study' | 'series' | 'instance';
  resourceId: string;
  resourceLabel: string;
}

export function AnonymizeDialog({ open, onOpenChange, level, resourceId, resourceLabel }: AnonymizeDialogProps) {
  const { t } = useTranslation();
  const { startAnonymize } = useAnonymizeJob();
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientId, setNewPatientId] = useState('');
  const [keepStudyDesc, setKeepStudyDesc] = useState(false);
  const [keepSeriesDesc, setKeepSeriesDesc] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setNewPatientName('');
      setNewPatientId('');
      setKeepStudyDesc(false);
      setKeepSeriesDesc(false);
    }, 200);
  };

  const handleAnonymize = () => {
    startAnonymize(
      { level, id: resourceId, label: resourceLabel },
      {
        newPatientName: newPatientName || undefined,
        newPatientId: newPatientId || undefined,
        keepStudyDescription: keepStudyDesc,
        keepSeriesDescription: keepSeriesDesc,
      },
    );
    handleClose();
  };

  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('anonymize.title', { level: levelLabel })}
          </DialogTitle>
          <DialogDescription>
            {t('anonymize.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Resource summary */}
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">{resourceLabel}</p>
          <p className="text-xs text-muted-foreground capitalize">{level} · {resourceId}</p>
        </div>

        <Separator />

        {/* Settings */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="anon-patient-name">{t('anonymize.newPatientName')}</Label>
            <Input
              id="anon-patient-name"
              placeholder={t('anonymize.newPatientNamePlaceholder')}
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t('anonymize.newPatientNameHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anon-patient-id">{t('anonymize.newPatientId')}</Label>
            <Input
              id="anon-patient-id"
              placeholder={t('anonymize.newPatientIdPlaceholder')}
              value={newPatientId}
              onChange={(e) => setNewPatientId(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t('anonymize.newPatientIdHint')}</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">{t('anonymize.preserveFields')}</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="keep-study-desc" className="text-sm font-normal cursor-pointer">
                {t('anonymize.keepStudyDescription')}
              </Label>
              <Switch id="keep-study-desc" checked={keepStudyDesc} onCheckedChange={setKeepStudyDesc} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="keep-series-desc" className="text-sm font-normal cursor-pointer">
                {t('anonymize.keepSeriesDescription')}
              </Label>
              <Switch id="keep-series-desc" checked={keepSeriesDesc} onCheckedChange={setKeepSeriesDesc} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button onClick={handleAnonymize} className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {t('anonymize.button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
