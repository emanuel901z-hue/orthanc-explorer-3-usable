/**
 * Field-level before/after table for a change-log entry or an import plan.
 */
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { diffFields, formatValue } from '../lib/config-diff';

export function ConfigDiffTable({ before, after }: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const { t } = useTranslation();
  const diffs = diffFields(before, after);

  if (diffs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('broker.diffNoChanges')}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('broker.diffField')}</TableHead>
          <TableHead>{t('broker.diffBefore')}</TableHead>
          <TableHead className="w-8" />
          <TableHead>{t('broker.diffAfter')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {diffs.map(({ field, before: b, after: a }) => (
          <TableRow key={field}>
            <TableCell className="font-mono text-xs">{field}</TableCell>
            <TableCell className="break-all font-mono text-xs text-muted-foreground">
              {formatValue(b)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
            </TableCell>
            <TableCell className="break-all font-mono text-xs">{formatValue(a)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
