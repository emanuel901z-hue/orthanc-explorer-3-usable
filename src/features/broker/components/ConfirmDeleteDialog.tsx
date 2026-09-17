/**
 * Reusable delete confirmation for broker configuration rows.
 */
import { useTranslation } from 'react-i18next';
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

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  pending,
  warning,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  pending: boolean;
  /** Extra consequence the operator has to see (e.g. dependent rules). */
  warning?: string | null;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('broker.confirmDeleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('broker.confirmDeleteBody', { name: itemName })}
          </AlertDialogDescription>
          {warning && (
            <p className="text-sm font-medium text-destructive">{warning}</p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
          >
            {pending ? t('common.loading', { defaultValue: 'Loading…' }) : t('common.delete', { defaultValue: 'Delete' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
