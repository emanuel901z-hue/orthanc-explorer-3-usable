import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus } from 'lucide-react';
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
import type { CopyTarget } from '@/api/targets';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: CopyTarget[];
  onSave: (targets: CopyTarget[]) => Promise<void> | void;
  saving?: boolean;
};

/**
 * Kopierziele pflegen (nur AET).
 *
 * Diese Liste liegt serverseitig, damit sie alle Benutzer sehen — anders als
 * die Orthanc-Modalitäten brauchen diese Ziele keine Adresse.
 */
export default function TargetsDialog({ open, onOpenChange, targets, onSave, saving }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CopyTarget[]>(targets);
  const [aet, setAet] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setDraft(targets);
      setAet('');
      setLabel('');
      setError(undefined);
    }
  }, [open, targets]);

  const add = () => {
    const cleanAet = aet.trim();
    const cleanLabel = label.trim();
    if (!cleanAet) {
      setError(t('targets.errAet', { defaultValue: 'Please enter an AE title.' }));
      return;
    }
    if (cleanAet.length > 16) {
      setError(t('targets.errAetLength', { defaultValue: 'An AE title has at most 16 characters.' }));
      return;
    }
    if (draft.some((entry) => entry.aet === cleanAet)) {
      setError(t('targets.errDuplicate', { defaultValue: 'This AE title already exists.' }));
      return;
    }
    setDraft([...draft, { aet: cleanAet, label: cleanLabel || cleanAet }]);
    setAet('');
    setLabel('');
    setError(undefined);
  };

  const remove = (target: string) => setDraft(draft.filter((entry) => entry.aet !== target));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('targets.title', { defaultValue: 'Copy targets' })}</DialogTitle>
          <DialogDescription>
            {t('targets.description', {
              defaultValue:
                'Destinations the archive delivers to. Only the AE title is needed — the archive knows the address. Visible to all users.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto space-y-3 pr-1">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              className="h-9 sm:w-[200px] font-mono"
              placeholder={t('targets.aetPlaceholder', { defaultValue: 'AE title (max. 16)' })}
              aria-label={t('targets.aet', { defaultValue: 'AE title' })}
              value={aet}
              onChange={(e) => setAet(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
            />
            <Input
              className="h-9 flex-1"
              placeholder={t('targets.labelPlaceholder', { defaultValue: 'Label (e.g. house or department)' })}
              aria-label={t('targets.label', { defaultValue: 'Label' })}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
            />
            <Button variant="outline" className="h-9 gap-1.5" onClick={add}>
              <Plus className="h-4 w-4" />
              {t('targets.add', { defaultValue: 'Add' })}
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <ul className="divide-y rounded-md border">
            {draft.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                {t('targets.empty', { defaultValue: 'No targets yet.' })}
              </li>
            )}
            {draft.map((entry) => (
              <li key={entry.aet} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{entry.label ?? entry.aet}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{entry.aet}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  aria-label={t('targets.remove', { defaultValue: 'Remove {{aet}}', aet: entry.aet })}
                  onClick={() => remove(entry.aet)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('targets.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button disabled={saving} onClick={() => void onSave(draft)}>
            {saving ? t('targets.saving', { defaultValue: 'Saving…' }) : t('targets.save', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
