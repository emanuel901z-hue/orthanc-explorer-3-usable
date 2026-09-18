/**
 * Discard guard for the broker dialogs.
 *
 * Closing a form with Esc or a click beside it used to throw the input away
 * without a word. The guard asks first — but only when something was actually
 * entered, so a quick look-around still closes instantly.
 */
import { useState } from 'react';
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

export function useDiscardGuard(dirty: boolean, close: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Use as the dialog's `onOpenChange`. */
  const requestClose = (open: boolean) => {
    if (open) return;
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    close();
  };

  return { confirmOpen, setConfirmOpen, requestClose, close };
}

export function DiscardConfirm({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('broker.discardTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('broker.discardHint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('broker.discardKeep')}</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>{t('broker.discardConfirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
