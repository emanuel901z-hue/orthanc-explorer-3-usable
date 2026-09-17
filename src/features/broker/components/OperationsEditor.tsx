/**
 * Editor for DICOM attribute operations of a transform rule.
 *
 * Operations are applied top-down; the broker validates every keyword against
 * the DICOM data dictionary (and rejects UID modifications), so the UI only
 * has to collect them.
 */
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransformOperation, TransformOpKind } from '@/api/broker';

const OP_KINDS: TransformOpKind[] = ['set', 'remove', 'prefix', 'suffix', 'replace', 'copy'];

const EMPTY_OPERATION: TransformOperation = { op: 'set', tag: '', value: '' };

export function OperationsEditor({
  operations,
  onChange,
}: {
  operations: TransformOperation[];
  onChange: (operations: TransformOperation[]) => void;
}) {
  const { t } = useTranslation();

  const update = (index: number, patch: Partial<TransformOperation>) =>
    onChange(operations.map((op, i) => (i === index ? { ...op, ...patch } : op)));

  const remove = (index: number) => onChange(operations.filter((_, i) => i !== index));

  const add = () => onChange([...operations, { ...EMPTY_OPERATION }]);

  return (
    <div className="space-y-3">
      {operations.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('broker.noOperations')}</p>
      )}

      {operations.map((op, index) => (
        <div key={index} className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('broker.operation', { index: index + 1 })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              aria-label={t('broker.removeOperation')}
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`op-kind-${index}`}>{t('broker.opKind')}</Label>
              <Select
                value={op.op}
                onValueChange={(v) => update(index, { op: v as TransformOpKind })}
              >
                <SelectTrigger id={`op-kind-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OP_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`broker.op_${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`op-tag-${index}`}>{t('broker.opTag')}</Label>
              <Input
                id={`op-tag-${index}`}
                value={op.tag}
                onChange={(e) => update(index, { tag: e.target.value })}
                placeholder="PatientID"
                className="font-mono"
              />
            </div>

            {op.op === 'copy' ? (
              <div className="space-y-1">
                <Label htmlFor={`op-from-${index}`}>{t('broker.opFromTag')}</Label>
                <Input
                  id={`op-from-${index}`}
                  value={op.from_tag ?? ''}
                  onChange={(e) => update(index, { from_tag: e.target.value })}
                  placeholder="RequestedProcedureDescription"
                  className="font-mono"
                />
              </div>
            ) : op.op !== 'remove' ? (
              <>
                {op.op === 'replace' && (
                  <div className="space-y-1">
                    <Label htmlFor={`op-pattern-${index}`}>{t('broker.opPattern')}</Label>
                    <Input
                      id={`op-pattern-${index}`}
                      value={op.pattern ?? ''}
                      onChange={(e) => update(index, { pattern: e.target.value })}
                      placeholder="^ALT"
                      className="font-mono"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor={`op-value-${index}`}>{t('broker.opValue')}</Label>
                  <Input
                    id={`op-value-${index}`}
                    value={op.value ?? ''}
                    onChange={(e) => update(index, { value: e.target.value })}
                    placeholder={op.op === 'set' ? 'Klinikum' : 'KH_'}
                    className="font-mono"
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" />
        {t('broker.addOperation')}
      </Button>
    </div>
  );
}
